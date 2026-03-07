import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { openrouter, MODEL, SYSTEM_PROMPT } from '@/lib/gemini'
import { checkRateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // 1. Auth check
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit check
  const { allowed, hoursUntilReset } = await checkRateLimit(user.id)

  if (!allowed) {
    return NextResponse.json(
      { error: `Daily limit reached. Resets in ${hoursUntilReset} hour${hoursUntilReset === 1 ? '' : 's'}.` },
      { status: 429 }
    )
  }

  // 3. Parse request body
  const body = await req.json()
  const { prompt, projectId, currentCode } = body as {
    prompt: string
    projectId: string
    currentCode?: string
  }

  if (!prompt || !projectId) {
    return NextResponse.json({ error: 'prompt and projectId are required' }, { status: 400 })
  }

  // Verify project ownership
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // 4. Log prompt to DB
  await supabaseAdmin.from('prompts').insert({
    user_id: user.id,
    project_id: projectId,
    content: prompt,
  })

  // 5. Build messages
  const userMessage = currentCode
    ? `Current code:\n${currentCode}\n\nUser request: ${prompt}`
    : prompt

  // 6. Stream OpenRouter response
  const encoder = new TextEncoder()
  let fullCode = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await openrouter.chat.completions.create({
          model: MODEL,
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
        })

        for await (const chunk of result) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (!text) continue
          fullCode += text
          controller.enqueue(encoder.encode(text))
        }

        controller.close()

        // 7. Save final HTML to DB after stream completes
        await supabaseAdmin
          .from('projects')
          .update({
            files: { 'index.html': fullCode },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
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
    },
  })
}
