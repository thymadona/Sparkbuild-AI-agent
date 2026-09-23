import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, messages, projects, prompts } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { deepseek, MODEL } from '@/lib/deepseek'
import { checkRateLimit } from '@/lib/ratelimit'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { getLessonForProject, hasCompletedTask, type LessonTask } from '@/lib/lessons'
import { entryFileFor } from '@/lib/starter-file'
import { pageCode, withBoardCode } from '@/lib/board/code'
import { awaitingEditor, taskForPageId, taskPageId } from '@/lib/board/tasks'
import { cached } from '@/lib/cache'
import {
  CONCEPT_PHASE_NUDGE,
  buildTaskNudge,
  detectConfusion,
  escalationTier,
  isTaskLocked,
  pendingCoreTask,
} from '@/lib/task-guard'
import { isRuntimeCheck } from '@/lib/task-checks'
import { verifyTask } from '@/lib/task-verify'
import { recordTaskDone } from '@/lib/task-progress'
import {
  describeEvidence,
  describeTaskState,
  hasRun,
  outputVerdict,
  taskPrograms,
  type Program,
} from '@/lib/task-evidence'
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
    const { allowed } = await checkRateLimit(user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Slow down and try again in a moment.' },
        { status: 429 }
      )
    }
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const parsed = ClientEvent.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event' }, { status: 400 })

  const [project] = await db

    .select({
      board: projects.board,
      files: projects.files,
      lessonId: projects.lessonId,
      lessonVersion: projects.lessonVersion,
    })
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid event' },
      { status: 400 }
    )
  }
  board = event.board
  const lesson =
    project.lessonId != null ? getLessonForProject(project.lessonId, project.lessonVersion) : null
  const files = (project.files ?? {}) as Record<string, string>

  // The lesson guard. Without it the tutor narrates the lesson on vibes: it
  // congratulates the student for a task whose checks have not passed and
  // announces the next one, while their screen correctly refuses to move on.
  // Same source of truth as the student's board — the task's own checks.
  let openTask: LessonTask | null = null
  let nudge = ''
  let evidence = ''
  let programs: Program[] = []
  let canComplete = false
  let recent = history // the conversation about the open task; older talk is about other tasks
  if (lesson) {
    const progress = await cached(`lesson-progress:${id}`, 15, async () => {
      const [row] = await db
        .select({
          completed_task_ids: lessonProgress.completedTaskIds,
          updated_at: lessonProgress.updatedAt,
        })
        .from(lessonProgress)
        .where(eq(lessonProgress.projectId, id))
        .limit(1)

      return row ?? null
    })
    const doneIds = progress?.completed_task_ids ?? []
    openTask = pendingCoreTask(lesson, doneIds)
    // Choice/bonus tasks never gate the lesson, so pendingCoreTask never answers
    // with one — but once unlocked they are a real task the student can be
    // working on. Let the one they're actually looking at take the turn, or it
    // can never be finished: task_complete only ever names the pending core task.
    const viewedTask = taskForPageId(lesson, board.activePageId)
    if (
      viewedTask &&
      viewedTask.type !== 'core' &&
      !hasCompletedTask(new Set(doneIds), viewedTask.id) &&
      !isTaskLocked(lesson.tasks, lesson.tasks.indexOf(viewedTask), new Set(doneIds))
    ) {
      openTask = viewedTask
    }
    if (openTask) {
      // The checklist is a rubric for the tutor, not a verdict: the tutor judges
      // the evidence itself and completes the task with task_complete.
      const entry = entryFileFor(lesson, files)
      const run = parsed.data.type === 'code_run_result' ? parsed.data : undefined
      programs = taskPrograms(board, openTask, entry, run)
      evidence = describeEvidence(programs)

      // Turns spent on this task: messages since it became open. Same reading of
      // lesson_progress.updated_at as /api/generate, valid while the
      // lesson-progress PUT route stays the sole writer of that column.
      const since = progress?.updated_at ? Date.parse(progress.updated_at) : NaN
      const onTask = Number.isNaN(since)
        ? history
        : history.filter((m) => Date.parse(String(m.createdAt)) >= since)
      recent = onTask
      // Only what the student wrote counts: Spark's replies to each Run are not a sign
      // of being stuck, and counting them escalated a first attempt to "do it with them".
      const stuckTurns = onTask.filter((m) => m.role === 'user').length
      const prevUserMessage = [...onTask].reverse().find((m) => m.role === 'user')?.content
      const askedNow = parsed.data.type === 'student_message' ? parsed.data.text : ''
      const tier = escalationTier(stuckTurns, detectConfusion(askedNow, prevUserMessage))
      const concept = awaitingEditor(board, openTask, taskPageId(openTask))
      canComplete = !concept
      nudge = concept
        ? [CONCEPT_PHASE_NUDGE, describeTaskState(board, openTask, programs, entry)].join('\n\n')
        : [
            buildTaskNudge(openTask, tier),
            describeTaskState(board, openTask, programs, entry),
            evidence,
          ].join('\n\n')
    }
  }

  // A run is judged from its evidence alone. Spark's earlier replies ("nothing changed") are
  // stale by now, and a small model repeats them instead of reading the new run.
  const system = [
    TUTOR_PROMPT,
    lessonLayer(lesson, summarize(board, openTask ? taskPageId(openTask) : undefined), openTask),
    nudge,
  ]
    .filter(Boolean)
    .join('\n\n')
  const userContent = event.content

  const llm: Llm = (msgs) =>
    deepseek.chat.completions.create({
      model: MODEL,
      stream: true,
      // Sparky only reflects on Bolt's block: a turn with no tools cannot write code.
      ...(parsed.data.type === 'helper_result'
        ? {}
        : { tools: toolsFor(lesson != null, canComplete) }),
      messages: msgs,
      thinking: { type: 'disabled' }, // DeepSeek extension; captions must start fast
    } as never) as unknown as ReturnType<Llm>

  // The tutor's verdict, checked before it is written. A child will say "I'm
  // done" whether or not it is true, and a model can be talked into agreeing.
  const onTaskComplete = async ({ taskId, reason }: { taskId: string; reason: string }) => {
    if (!lesson || !openTask || !canComplete) throw new Error('no task is open')
    if (taskId !== openTask.id)
      throw new Error(`the open task is "${openTask.id}", not "${taskId}"`)
    if (!hasRun(programs))
      throw new Error(
        'the student has not run this exact code yet (or edited it after running); ask them to press Run'
      )
    const entry = entryFileFor(lesson, files)
    const code = programs.find((p) => p.file === entry)?.source ?? programs[0]?.source ?? ''
    // The floor: static checks, and every output check the reported run can answer. Only
    // what needs Python itself (world events, calls, typed input) is left to the tutor.
    const floor = verifyTask(
      openTask,
      code,
      (openTask.checks ?? []).map(
        (c) => outputVerdict(c, programs, entry) ?? (isRuntimeCheck(c) || undefined)
      )
    )
    if (!floor.passed)
      throw new Error(
        `not finished: ${floor.failed?.hint ?? floor.failed?.label ?? 'a requirement is unmet'}`
      )
    return recordTaskDone(id, user.id, openTask.id, { reason, programs })
  }

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
          onTaskComplete,
          messages: [
            { role: 'system', content: system },
            ...(parsed.data.type === 'code_run_result' ? [] : recent).map((m) => ({
              role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
              // A Bolt exchange is not the student talking to Sparky (and is not a stuck turn:
              // stuckTurns counts only 'user' rows).
              content:
                m.role === 'helper' ? `<bolt_exchange>\n${m.content}\n</bolt_exchange>` : m.content,
            })),
            { role: 'user', content: userContent },
          ],
        })
        // Ownership predicate repeated so the write can't outlive the check above.
        await db
          .update(projects)
          .set({
            board: result.board,
            files: withBoardCode(files, entryFileFor(lesson, files), result.board),
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
        const rows = [
          ...(event.saveText
            ? [{ projectId: id, userId: user.id, role: 'user' as const, content: event.saveText }]
            : []),
          ...(result.text
            ? [{ projectId: id, userId: user.id, role: 'assistant' as const, content: result.text }]
            : []),
        ]
        if (rows.length) await db.insert(messages).values(rows)
        await db
          .insert(prompts)
          .values({
            userId: user.id,
            projectId: id,
            content: userContent,
            context: { tutor: 'board', system },
          })
          .catch((e) => console.error('prompt log failed:', e))
      } catch (err) {
        console.error('tutor turn error:', err)
        send({ type: 'error', message: 'Sparky had a problem. Try again.' })
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
