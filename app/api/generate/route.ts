import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { deepseek, MODEL, ASK_SYSTEM_PROMPT, BUILD_SYSTEM_PROMPT } from '@/lib/gemini'
import { checkRateLimit } from '@/lib/ratelimit'
import { parseMultiFileResponse, parseSummary } from '@/lib/parse-multi-file'
import { getLessonForProject } from '@/lib/lessons'
import { buildTaskNudge, pendingCoreTask } from '@/lib/task-guard'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { cached } from '@/lib/cache'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // 1. Auth check
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit check (skip for admins and teachers — role-based, not ADMIN_EMAILS)
  const [userIsAdmin, userIsTeacher] = await Promise.all([isAdmin(user.id), isTeacher(user.id)])
  const bypassRateLimit = userIsAdmin || userIsTeacher

  const { allowed, hoursUntilReset } = bypassRateLimit ? { allowed: true, hoursUntilReset: 0 } : await checkRateLimit(user.id)

  if (!allowed) {
    return NextResponse.json(
      { error: `Hourly limit reached. Resets in ${hoursUntilReset} hour${hoursUntilReset === 1 ? '' : 's'}.` },
      { status: 429 }
    )
  }

  // 3. Parse request body
  const body = await req.json()
  const { prompt, projectId, files, history, selectedCode, mode } = body as {
    prompt: string
    projectId: string
    files?: Record<string, string>
    history?: { role: 'user' | 'assistant'; content: string }[]
    selectedCode?: string
    mode?: 'ask' | 'build'
  }

  if (!prompt || !projectId) {
    return NextResponse.json({ error: 'prompt and projectId are required' }, { status: 400 })
  }

  // Verify project ownership — cached, since lesson_id/lesson_version never
  // change after project creation, but user_id is still checked below on
  // every request (caching the row doesn't skip the ownership check).
  const project = await cached(`project-meta:${projectId}`, 3600, async () => {
    const { data } = await supabaseAdmin
      .from('projects')
      .select('user_id, lesson_id, lesson_version')
      .eq('id', projectId)
      .single()
    return data
  })

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // 3a. Lesson guard — while a core task is open, the student writes the code.
  let openTask = null
  if (project.lesson_id != null) {
    const lesson = getLessonForProject(project.lesson_id, project.lesson_version)
    // Short TTL backstop only — the PUT lesson-progress route explicitly
    // invalidates this key, since it directly feeds build-mode gating.
    const progress = await cached(`lesson-progress:${projectId}`, 15, async () => {
      const { data } = await supabaseAdmin
        .from('lesson_progress')
        .select('completed_task_ids')
        .eq('project_id', projectId)
        .maybeSingle()
      return data
    })
    openTask = pendingCoreTask(lesson, progress?.completed_task_ids ?? [])
  }

  // 3b. Resolve effective mode — check per-user permission (server is authoritative)
  let effectiveMode: 'ask' | 'build' = 'ask'
  if (mode === 'build' && !openTask) {
    const setting = await cached(`build-mode:${user.id}`, 30, async () => {
      const { data } = await supabaseAdmin.from('user_build_mode').select('enabled').eq('user_id', user.id).single()
      return data
    })
    if (setting?.enabled === true) effectiveMode = 'build'
  }
  const BASE_SYSTEM_PROMPT = effectiveMode === 'build' ? BUILD_SYSTEM_PROMPT : ASK_SYSTEM_PROMPT

  // 4. Log prompt to DB (for rate limiting)
  await supabaseAdmin.from('prompts').insert({
    user_id: user.id,
    project_id: projectId,
    content: prompt,
  })

  // 5. Build messages
  let filesContext = ''
  if (files && Object.keys(files).length > 0) {
    filesContext = Object.entries(files)
      .map(([name, content]) => {
        const numbered = content
          .split('\n')
          .map((line, i) => `${i + 1} | ${line}`)
          .join('\n')
        return `--- FILE: ${name} ---\n${numbered}`
      })
      .join('\n\n')
  }

  const systemContent = [
    BASE_SYSTEM_PROMPT,
    openTask ? buildTaskNudge(openTask) : '',
    filesContext ? `Current project files:\n${filesContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const userContent = selectedCode
    ? `Selected code:\n\`\`\`\n${selectedCode}\n\`\`\`\n\n${prompt}`
    : prompt

  const recentHistory = (history ?? []).slice(-10)

  const llmMessages = [
    { role: 'system' as const, content: systemContent },
    ...recentHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userContent },
  ]

  // 6. Stream DeepSeek response
  const encoder = new TextEncoder()
  let accumulated = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await deepseek.chat.completions.create({
          model: MODEL,
          stream: true,
          stream_options: { include_usage: true },
          messages: llmMessages,
        })

        for await (const chunk of result) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            accumulated += text
            controller.enqueue(encoder.encode(text))
          }

          // DeepSeek caches repeated prompt prefixes on disk automatically;
          // this surfaces the hit rate in logs (fields aren't in the OpenAI
          // SDK's types since they're a DeepSeek-specific extension).
          const usage = chunk.usage as { prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number } | undefined
          if (usage) {
            console.log(`[deepseek cache] hit=${usage.prompt_cache_hit_tokens ?? 0} miss=${usage.prompt_cache_miss_tokens ?? 0}`)
          }
        }

        controller.close()

        // 7. Determine response type and save accordingly
        const isCode = accumulated.trimStart().startsWith('--- FILE:')
        let assistantContent = accumulated

        if (isCode) {
          const parsedFiles = parseMultiFileResponse(accumulated)
          if (parsedFiles) {
            await supabaseAdmin
              .from('projects')
              .update({
                files: parsedFiles,
                updated_at: new Date().toISOString(),
              })
              .eq('id', projectId)
          }
          assistantContent = parseSummary(accumulated) ?? "I've built that for you! Check the preview."
        }

        // 8. Persist chat messages
        const { error: msgError } = await supabaseAdmin.from('messages').insert([
          {
            project_id: projectId,
            user_id: user.id,
            role: 'user',
            content: prompt,
          },
          {
            project_id: projectId,
            user_id: user.id,
            role: 'assistant',
            content: assistantContent,
          },
        ])
        if (msgError) console.error('messages insert error:', msgError)
      } catch (err) {
        console.error('OpenRouter stream error:', err)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Lets the client explain why a build request came back as tutoring.
      'X-Effective-Mode': effectiveMode,
      ...(openTask ? { 'X-Open-Task': openTask.id } : {}),
    },
  })
}
