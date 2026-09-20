import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress } from '@/lib/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { getLessonProject } from '@/lib/lesson-project'
import { entryFileFor } from '@/lib/starter-file'
import { invalidate } from '@/lib/cache'
import { recordActivity } from '@/lib/player-stats'
import { isTaskOpen } from '@/lib/board/tasks'
import { isTaskLocked } from '@/lib/task-guard'
import { taskCode, verifyTask } from '@/lib/task-verify'
import type { BoardState } from '@/lib/board/reducer'
import type { RuntimeVerdicts } from '@/lib/task-checks'

export const runtime = 'nodejs'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Finish one task. The board has no Mark done button — a task completes when
 * its checks pass — so this is where that judgement is made, against the code
 * the server has stored rather than the client's word for it. The PUT sibling
 * can only ever shrink the set; growing it goes through here.
 */
export async function POST(req: Request, props: Props) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lessonProject = await getLessonProject(params.id, user.id)
  if (!lessonProject) return NextResponse.json({ error: 'Lesson project not found' }, { status: 404 })
  const { project, lesson } = lessonProject

  const body = await req.json().catch(() => ({}))
  const index = lesson.tasks.findIndex((t) => t.id === body.taskId)
  if (index < 0) return NextResponse.json({ error: 'Unknown task' }, { status: 400 })
  const task = lesson.tasks[index]

  let completed: string[]
  try {
    const [row] = await db
      .select({ completed_task_ids: lessonProgress.completedTaskIds })
      .from(lessonProgress)
      .where(eq(lessonProgress.projectId, params.id))
      .limit(1)

    completed = row?.completed_task_ids ?? []
  } catch (err) {
    console.error('lesson-progress complete read failed:', err)
    return NextResponse.json({ error: 'Failed to read progress' }, { status: 500 })
  }

  // Already done: say so rather than rewriting the row, so a retry after a
  // dropped response is harmless.
  const done = new Set(completed)
  if (done.has(task.id)) return NextResponse.json({ completedTaskIds: completed, alreadyDone: true })

  // Order is part of the lesson: a student cannot reach past an open task, and
  // homework stays shut until the lesson itself is finished.
  if (isTaskLocked(lesson.tasks, index, done) || !isTaskOpen(lesson, index, done)) {
    return NextResponse.json({ error: 'Finish the task before this one first' }, { status: 409 })
  }

  const files = (project.files ?? {}) as Record<string, string>
  const entry = entryFileFor(lesson, files)
  const reported = Array.isArray(body.runtimeVerdicts)
    ? (body.runtimeVerdicts.map((v: unknown) => (typeof v === 'boolean' ? v : undefined)) as RuntimeVerdicts)
    : []
  const verdict = verifyTask(task, taskCode(project.board as BoardState | null, files, entry, task), reported)
  if (!verdict.passed) {
    return NextResponse.json(
      { error: verdict.failed?.hint ?? 'This task is not finished yet', check: verdict.failed?.label ?? null, results: verdict.results },
      { status: 409 },
    )
  }

  const next = [...completed, task.id]
  try {
    await db
      .insert(lessonProgress)
      .values({ projectId: params.id, completedTaskIds: next, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: lessonProgress.projectId,
        set: { completedTaskIds: next, updatedAt: new Date().toISOString() },
      })
  } catch (err) {
    console.error('lesson-progress complete failed:', err)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }

  // The generate and turn routes gate build mode on this, so it must not go stale.
  await invalidate(`lesson-progress:${params.id}`)
  // Finishing a task counts as a day of work. Never worth failing the save.
  await recordActivity(user.id).catch((err) => console.error('recordActivity failed:', err))

  return NextResponse.json({ completedTaskIds: next })
}
