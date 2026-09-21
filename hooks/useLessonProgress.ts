'use client'

import { useState } from 'react'
import type { Lesson, LessonTask } from '@/lib/lessons'
import { highlightLinesForTask } from '@/lib/task-checks'
import { isTaskLocked } from '@/lib/task-guard'
import type { SubmissionStatus } from '@/types'
import type { RuntimeChecks } from '@/hooks/useRuntimeChecks'

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
  initialSubmissionStatus?: SubmissionStatus | null
  onHighlight: (lines: number[]) => void
  onPrompt: (prompt: string) => void
  // Fired only after a task is actually saved as done — the cue for things
  // like a completion celebration, which should never fire on a failed save.
  // nextDone is the just-saved done set, so callers can detect "every task
  // done" without reading stale state from the closure.
  onComplete?: (task: LessonTask, nextDone: Set<string>) => void
  // Python verdicts from the student's browser. The server recomputes every
  // static check itself but cannot run Python, so these ride along. Read at
  // call time: the verdicts are derived from the active task, so a caller
  // cannot always have them in hand before this hook runs.
  runtime?: () => RuntimeChecks | null
  // Writes unsaved work before a task is judged. The server checks the code it
  // has stored, so a debounced save still in flight would fail the task.
  beforeComplete?: () => Promise<void>
}

/**
 * Task and homework progress shared between the Tasks and Homework side
 * panels. Both act on the same lesson and the same "done" set, so the state
 * has to live above either panel rather than be duplicated in each.
 */
export function useLessonProgress({
  lesson,
  projectId,
  code,
  initialCompletedTaskIds,
  initialSubmissionStatus = null,
  onHighlight,
  onPrompt,
  onComplete,
  runtime,
  beforeComplete,
}: UseLessonProgressArgs) {
  const tasks = lesson?.tasks ?? []
  const [done, setDone] = useState(() => new Set(initialCompletedTaskIds))
  const [activeIndex, setActiveIndex] = useState(() =>
    firstUnfinishedTaskIndex(tasks, new Set(initialCompletedTaskIds))
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<SubmissionStatus | null>(initialSubmissionStatus)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const activeTask = tasks[activeIndex]

  function activateTask(index: number) {
    const task = tasks[index]
    if (!task || done.has(task.id) || isTaskLocked(tasks, index, done)) return
    setActiveIndex(index)
    onHighlight(highlightLinesForTask(code, task.commentAnchor, task.checks))
    onPrompt(task.prompt)
  }

  /**
   * Finish a task. Deliberately not optimistic: the server re-runs the task's
   * checks against the code it has stored and is the one that decides, so the
   * done set only moves once the database says so. On the board that ordering
   * is the whole point — the next page opens off the back of a real write, not
   * of what the browser believed.
   */
  async function markDone(index: number) {
    const task = tasks[index]
    if (!task || done.has(task.id) || isSaving || isTaskLocked(tasks, index, done)) return

    setSaveError(null)
    setIsSaving(true)

    try {
      await beforeComplete?.()
      const response = await fetch(`/api/projects/${projectId}/lesson-progress/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          runtimeVerdicts: (() => {
            const r = runtime?.()
            return r?.taskId === task.id ? r.verdicts : []
          })(),
        }),
      })
      // Not every failure arrives as JSON — a proxy error page, or a body-less
      // response, must still read as "it did not save" rather than throw here.
      const data = (await Promise.resolve(response.json()).catch(() => null)) ?? {}
      if (!response.ok) throw new Error(data.error ?? 'Could not save progress')

      const nextDone = new Set<string>(data.completedTaskIds ?? [...done, task.id])
      setDone(nextDone)
      setActiveIndex(firstUnfinishedTaskIndex(tasks, nextDone))
      if (!data.alreadyDone) onComplete?.(task, nextDone)
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Your task was not saved. Please try again.'
      )
    } finally {
      setIsSaving(false)
    }
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

  async function submitHomework(homeworkReady: boolean) {
    if (!homeworkReady || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/submit`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not hand in your homework')
      setSubmission(data.submissionStatus ?? 'submitted')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not hand in your homework')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    done,
    activeIndex,
    activeTask,
    isSaving,
    saveError,
    submission,
    isSubmitting,
    submitError,
    activateTask,
    markDone,
    resetProgress,
    submitHomework,
  }
}
