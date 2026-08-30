import { NextResponse } from 'next/server'
import type OpenAI from 'openai'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, messages, projects, prompts, userBuildMode } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { deepseek, MODEL, ASK_SYSTEM_PROMPT, BUILD_SYSTEM_PROMPT } from '@/lib/gemini'
import { checkRateLimit } from '@/lib/ratelimit'
import { isCodeResponse, parseMultiFileResponse, parseSummary } from '@/lib/parse-multi-file'
import { getLessonForProject } from '@/lib/lessons'
import { buildTaskNudge, pendingCoreTask } from '@/lib/task-guard'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { cached } from '@/lib/cache'
import { getSessionUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // 1. Auth check
  const user = await getSessionUser()

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
  const { prompt, projectId, files, history, selectedCode, mode, reasoningEffort } = body as {
    prompt: string
    projectId: string
    files?: Record<string, string>
    history?: { role: 'user' | 'assistant'; content: string }[]
    selectedCode?: string
    mode?: 'ask' | 'build'
    reasoningEffort?: 'low' | 'high' | 'max'
  }
  const VALID_REASONING_EFFORTS = ['low', 'high', 'max']
  const effectiveReasoningEffort = VALID_REASONING_EFFORTS.includes(reasoningEffort ?? '') ? reasoningEffort! : 'low'

  if (!prompt || !projectId) {
    return NextResponse.json({ error: 'prompt and projectId are required' }, { status: 400 })
  }

  // Verify project ownership — cached, since lesson_id/lesson_version never
  // change after project creation, but user_id is still checked below on
  // every request (caching the row doesn't skip the ownership check).
  if (!isUuid(projectId)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const project = await cached(`project-meta:${projectId}`, 3600, async () => {
    const [row] = await db
      .select({
        user_id: projects.userId,
        lesson_id: projects.lessonId,
        lesson_version: projects.lessonVersion,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    // `?? null` matters: cached() JSON-encodes what this returns, and
    // JSON.stringify(undefined) is undefined — which ioredis would store as
    // the literal string "undefined" and the next read would fail to parse.
    return row ?? null
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
      const [row] = await db
        .select({ completed_task_ids: lessonProgress.completedTaskIds })
        .from(lessonProgress)
        .where(eq(lessonProgress.projectId, projectId))
        .limit(1)

      return row ?? null
    })
    openTask = pendingCoreTask(lesson, progress?.completed_task_ids ?? [])
  }

  // 3b. Resolve effective mode — check per-user permission (server is authoritative)
  let effectiveMode: 'ask' | 'build' = 'ask'
  if (mode === 'build' && !openTask) {
    const setting = await cached(`build-mode:${user.id}`, 30, async () => {
      const [row] = await db
        .select({ enabled: userBuildMode.enabled })
        .from(userBuildMode)
        .where(eq(userBuildMode.userId, user.id))
        .limit(1)

      return row ?? null
    })
    if (setting?.enabled === true) effectiveMode = 'build'
  }
  const BASE_SYSTEM_PROMPT = effectiveMode === 'build' ? BUILD_SYSTEM_PROMPT : ASK_SYSTEM_PROMPT

  // 4. Log prompt to DB (the permanent prompt log; the rate limit itself is
  // enforced in Redis by lib/ratelimit.ts). A logging failure must not cost
  // the student their generation.
  try {
    await db.insert(prompts).values({ userId: user.id, projectId, content: prompt })
  } catch (err) {
    console.error('prompt log insert failed:', err)
  }

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
        // DeepSeek-specific extension (not in the OpenAI SDK's types): thinking
        // mode is on by default for deepseek-v4-flash, which burns time on a
        // reasoning pass that's silently dropped below (only delta.content is
        // read, not delta.reasoning_content). Ask mode never needs it — replies
        // are three short sentences. Build mode keeps thinking on since it's
        // rewriting a whole file; effort defaults to low but the student can
        // raise it from the editor for a bigger/trickier build.
        const reasoningParams =
          effectiveMode === 'build'
            ? { thinking: { type: 'enabled' }, reasoning_effort: effectiveReasoningEffort }
            : { thinking: { type: 'disabled' } }

        const result = await deepseek.chat.completions.create({
          model: MODEL,
          stream: true,
          stream_options: { include_usage: true },
          messages: llmMessages,
          ...reasoningParams,
        } as OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
          thinking: { type: 'enabled' | 'disabled' }
          reasoning_effort?: 'low' | 'high' | 'max'
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
          // reasoning_tokens separates thinking-mode cost from output length,
          // to tell apart a slow reasoning pass from a long generated file.
          const usage = chunk.usage as
            | {
                prompt_cache_hit_tokens?: number
                prompt_cache_miss_tokens?: number
                completion_tokens?: number
                completion_tokens_details?: { reasoning_tokens?: number }
              }
            | undefined
          if (usage) {
            console.log(
              `[deepseek cache] hit=${usage.prompt_cache_hit_tokens ?? 0} miss=${usage.prompt_cache_miss_tokens ?? 0} reasoning_tokens=${usage.completion_tokens_details?.reasoning_tokens ?? 0} completion_tokens=${usage.completion_tokens ?? 0}`
            )
          }
        }

        controller.close()

        // 7. Determine response type and save accordingly
        const isCode = isCodeResponse(accumulated)
        let assistantContent = accumulated

        if (isCode) {
          const parsedFiles = parseMultiFileResponse(accumulated)
          if (parsedFiles) {
            // Ownership was established above, but the predicate is repeated
            // here so the write cannot outlive that check if the code above is
            // ever reordered.
            await db
              .update(projects)
              .set({ files: parsedFiles, updatedAt: new Date().toISOString() })
              .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
          }
          assistantContent = parseSummary(accumulated) ?? "I've built that for you! Check the preview."
        }

        // 8. Persist chat messages
        try {
          await db.insert(messages).values([
            { projectId, userId: user.id, role: 'user', content: prompt },
            { projectId, userId: user.id, role: 'assistant', content: assistantContent },
          ])
        } catch (err) {
          console.error('messages insert error:', err)
        }
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
