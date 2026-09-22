'use client'

import { useState } from 'react'
import type { Lesson, LessonTask } from '@/lib/lessons'
import { isTaskLocked } from '@/lib/task-guard'

export function firstUnfinishedTaskIndex(tasks: LessonTask[], completed: Set<string>) {
  const unfinishedCore = tasks.findIndex((task) => task.type === 'core' && !completed.has(task.id))
  if (unfinishedCore >= 0) return unfinishedCore
  const unfinishedOptional = tasks.findIndex((task) => !completed.has(task.id))
  return unfinishedOptional >= 0 ? unfinishedOptional : 0
}

interface UseLessonProgressArgs {
  lesson: Lesson | null
  projectId: string
  code: string
  initialCompletedTaskIds: string[]
  // Fired only after a task is actually saved as done — the cue for things
  // like a completion celebration, which should never fire on a failed save.
  // nextDone is the just-saved done set, so callers can detect "every task
  // done" without reading stale state from the closure.
  onComplete?: (task: LessonTask, nextDone: Set<string>) => void
}

/**
 * Task progress shared across the board. Acts on the lesson's "done" set, so
 * the state has to live above the panels that read it rather than be
 * duplicated in each.
 */
export function useLessonProgress({
  lesson,
  projectId,
  code,
  initialCompletedTaskIds,
  onComplete,
}: UseLessonProgressArgs) {
  const tasks = lesson?.tasks ?? []
  const [done, setDone] = useState(() => new Set(initialCompletedTaskIds))
  const [activeIndex, setActiveIndex] = useState(() =>
    firstUnfinishedTaskIndex(tasks, new Set(initialCompletedTaskIds))
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const activeTask = tasks[activeIndex]

  /**
   * A task is finished when the tutor says so and the server has recorded it
   * (the turn route's task_complete). The client never decides: it only takes
   * the recorded list and moves on.
   */
  function applyDone(ids: string[]) {
    const task = tasks.find((t) => ids.includes(t.id) && !done.has(t.id))
    const nextDone = new Set(ids)
    setDone(nextDone)
    setActiveIndex(firstUnfinishedTaskIndex(tasks, nextDone))
    if (task) onComplete?.(task, nextDone)
  }

  async function resetProgress() {
    setDone(new Set())
    setActiveIndex(firstUnfinishedTaskIndex(tasks, new Set()))
    setSaveError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/lesson-progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedTaskIds: [] }),
      })
      if (!response.ok) throw new Error('Could not reset progress')
    } catch {
      setSaveError('Your task progress was not reset. Please try again.')
    }
  }

  return {
    done,
    activeIndex,
    activeTask,
    isSaving,
    saveError,
    applyDone,
    resetProgress,
  }
}
