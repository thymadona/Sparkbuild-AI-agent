import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, messages, projects, prompts } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { deepseek, MODEL } from '@/lib/gemini'
import { checkRateLimit } from '@/lib/ratelimit'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { getLessonForProject } from '@/lib/lessons'
import { entryFileFor } from '@/lib/starter-file'
import { pageCode, withBoardCode } from '@/lib/board/code'
import { taskPageId } from '@/lib/board/tasks'
import { cached } from '@/lib/cache'
import { buildTaskNudge, detectConfusion, escalationTier, pendingCoreTask } from '@/lib/task-guard'
import { runTaskChecks, type RuntimeVerdicts } from '@/lib/task-checks'
import { emptyBoard, summarize, type BoardState } from '@/lib/board/reducer'
import { toolsFor } from '@/lib/board/tools'
import { ClientEvent, applyClientEvent } from '@/lib/tutor/events'
import { lessonLayer, TUTOR_PROMPT } from '@/lib/tutor/prompt'
import { runTurn, type Llm, type TurnEvent } from '@/lib/tutor/turn'

export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const [admin, teacher] = await Promise.all([isAdmin(user.id), isTeacher(user.id)])
  if (!admin && !teacher) {
    const { allowed, hoursUntilReset } = await checkRateLimit(user.id)
    if (!allowed) {
      return NextResponse.json({ error: `Hourly limit reached. Resets in ${hoursUntilReset} hour${hoursUntilReset === 1 ? '' : 's'}.` }, { status: 429 })
    }
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const parsed = ClientEvent.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event' }, { status: 400 })

  const [project] = await db
    
    .select({ board: projects.board, files: projects.files, lessonId: projects.lessonId, lessonVersion: projects.lessonVersion })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const history = (
    await db
      .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.projectId, id))
      .orderBy(desc(messages.createdAt))
      .limit(10)
  ).reverse()

  let board = (project.board as BoardState | null) ?? emptyBoard()
  let event: ReturnType<typeof applyClientEvent>
  try {
    event = applyClientEvent(board, parsed.data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid event' }, { status: 400 })
  }
  board = event.board
  const lesson = project.lessonId != null ? getLessonForProject(project.lessonId, project.lessonVersion) : null
  const files = (project.files ?? {}) as Record<string, string>

  // The lesson guard. Without it the tutor narrates the lesson on vibes: it
  // congratulates the student for a task whose checks have not passed and
  // announces the next one, while their screen correctly refuses to move on.
  // Same source of truth as the student's board — the task's own checks.
  let openTask = null
  let nudge = ''
  if (lesson) {
    const progress = await cached(`lesson-progress:${id}`, 15, async () => {
      const [row] = await db
        .select({ completed_task_ids: lessonProgress.completedTaskIds, updated_at: lessonProgress.updatedAt })
        .from(lessonProgress)
        .where(eq(lessonProgress.projectId, id))
        .limit(1)

      return row ?? null
    })
    openTask = pendingCoreTask(lesson, progress?.completed_task_ids ?? [])
    if (openTask) {
      // Python checks run in the student's browser; take its verdicts only if
      // they belong to the task the tutor is about to talk about. Absent, a
      // runtime check reads as unmet — the safe direction, since the tutor
      // then under-claims rather than declaring a task done that is not.
      const reported = body?.runtimeChecks as { taskId?: string; verdicts?: unknown[] } | undefined
      const verdicts: RuntimeVerdicts =
        reported?.taskId === openTask.id && Array.isArray(reported.verdicts)
          ? reported.verdicts.map((v) => (typeof v === 'boolean' ? v : undefined))
          : []
      const results = runTaskChecks(openTask.checks, pageCode(board, taskPageId(openTask)) ?? '', verdicts)

      // Turns spent on this task: messages since it became open. Same reading of
      // lesson_progress.updated_at as /api/generate, valid while the
      // lesson-progress PUT route stays the sole writer of that column.
      const since = progress?.updated_at ? Date.parse(progress.updated_at) : NaN
      const onTask = Number.isNaN(since) ? history : history.filter((m) => Date.parse(String(m.createdAt)) >= since)
      const stuckTurns = onTask.filter((m) => m.role === 'assistant').length
      const prevUserMessage = [...onTask].reverse().find((m) => m.role === 'user')?.content
      const askedNow = parsed.data.type === 'student_message' ? parsed.data.text : ''
      const tier = escalationTier(stuckTurns, detectConfusion(askedNow, prevUserMessage), openTask.type === 'homework')
      nudge = buildTaskNudge(openTask, tier, results)
    }
  }

  const system = [TUTOR_PROMPT, lessonLayer(lesson, summarize(board), openTask), nudge].filter(Boolean).join('\n\n')
  const userContent = event.content

  const llm: Llm = (msgs) =>
    deepseek.chat.completions.create({
      model: MODEL,
      stream: true,
      tools: toolsFor(lesson != null),
      messages: msgs,
      thinking: { type: 'disabled' }, // DeepSeek extension; captions must start fast
    } as never) as unknown as ReturnType<Llm>

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: TurnEvent | { type: 'error'; message: string }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      try {
        const result = await runTurn({
          llm,
          board,
          emit: send,
          messages: [
            { role: 'system', content: system },
            ...history.map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content })),
            { role: 'user', content: userContent },
          ],
        })
        // Ownership predicate repeated so the write can't outlive the check above.
        await db
          .update(projects)
          .set({ board: result.board, files: withBoardCode(files, entryFileFor(lesson, files), result.board), updatedAt: new Date().toISOString() })
          .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
        const rows = [
          ...(event.saveText ? [{ projectId: id, userId: user.id, role: 'user' as const, content: event.saveText }] : []),
          ...(result.text ? [{ projectId: id, userId: user.id, role: 'assistant' as const, content: result.text }] : []),
        ]
        if (rows.length) await db.insert(messages).values(rows)
        await db.insert(prompts).values({ userId: user.id, projectId: id, content: userContent, context: { tutor: 'board', system } }).catch((e) => console.error('prompt log failed:', e))
      } catch (err) {
        console.error('tutor turn error:', err)
        send({ type: 'error', message: 'Spark had a problem. Try again.' })
      }
      controller.close()
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
}
