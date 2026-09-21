import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, taskProgress } from '@/lib/db/schema'
import { invalidate } from '@/lib/cache'
import { recordActivity } from '@/lib/player-stats'
import type { Program } from '@/lib/task-evidence'

export interface Judgement {
  reason: string
  programs: Program[]
}

/**
 * The one place a task becomes done. The tutor's `task_complete` call ends up
 * here after the turn route has judged it; nothing the browser sends can.
 * The audit row (what the tutor saw, and why it said yes) and the read model
 * (`lesson_progress.completed_task_ids`, which XP, gates and the tutor read)
 * are written in one transaction, so neither can exist without the other.
 * Idempotent: a repeat returns the existing list without rewriting anything.
 */
export async function recordTaskDone(
  projectId: string,
  userId: string,
  taskId: string,
  judged: Judgement
): Promise<string[]> {
  const now = new Date().toISOString()
  const { ids, fresh } = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ ids: lessonProgress.completedTaskIds })
      .from(lessonProgress)
      .where(eq(lessonProgress.projectId, projectId))
      .for('update')
      .limit(1)
    const done = row?.ids ?? []
    if (done.includes(taskId)) return { ids: done, fresh: false }

    const next = [...done, taskId]
    await tx
      .insert(lessonProgress)
      .values({ projectId, completedTaskIds: next, updatedAt: now })
      .onConflictDoUpdate({
        target: lessonProgress.projectId,
        set: { completedTaskIds: next, updatedAt: now },
      })
    await tx
      .insert(taskProgress)
      .values({
        projectId,
        taskId,
        completedAt: now,
        reason: judged.reason.slice(0, 200),
        code: Object.fromEntries(judged.programs.map((p) => [p.file, p.source])),
        output: Object.fromEntries(
          judged.programs.filter((p) => p.stdout !== null).map((p) => [p.file, p.stdout])
        ),
      })
      .onConflictDoNothing()
    return { ids: next, fresh: true }
  })
  if (!fresh) return ids

  // The turn route gates the tutor on this, so it must not go stale.
  await invalidate(`lesson-progress:${projectId}`)
  // Finishing a task counts as a day of work. Never worth failing the save.
  await recordActivity(userId).catch((err) => console.error('recordActivity failed:', err))
  return ids
}
