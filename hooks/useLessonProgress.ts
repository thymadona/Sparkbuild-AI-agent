'use client'

import { useState } from 'react'
import type { Lesson, LessonTask } from '@/lib/lessons'
import type { SubmissionStatus } from '@/types'

function firstUnfinishedTaskIndex(tasks: LessonTask[], completed: Set<string>) {
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
  onHighlight: (line: number | null) => void
  onPrompt: (prompt: string) => void
  // Fired only after a task is actually saved as done — the cue for things
  // like a completion celebration, which should never fire on a failed save.
  onComplete?: (task: LessonTask) => void
}

/**
 * Task and homework progress shared between the Tasks and Homework side
 * panels. Both act on the same lesson and the same "done" set, so the state
 * has to live above either panel rather than be duplicated in each.
 */
export function useLessonProgress({ lesson, projectId, code, initialCompletedTaskIds, initialSubmissionStatus = null, onHighlight, onPrompt, onComplete }: UseLessonProgressArgs) {
  const tasks = lesson?.tasks ?? []
  const [done, setDone] = useState(() => new Set(initialCompletedTaskIds))
  const [activeIndex, setActiveIndex] = useState(() => firstUnfinishedTaskIndex(tasks, new Set(initialCompletedTaskIds)))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<SubmissionStatus | null>(initialSubmissionStatus)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const activeTask = tasks[activeIndex]

  function lineForTask(task: LessonTask) {
    const lineIndex = code.split('\n').findIndex((line) => line.includes(task.commentAnchor))
    return lineIndex >= 0 ? lineIndex + 1 : null
  }

  function activateTask(index: number) {
    const task = tasks[index]
    if (!task || done.has(task.id)) return
    setActiveIndex(index)
    onHighlight(lineForTask(task))
    onPrompt(task.prompt)
  }

  async function markDone(index: number) {
    const task = tasks[index]
    if (!task || done.has(task.id) || isSaving) return

    const nextDone = new Set(done)
    nextDone.add(task.id)
    setDone(nextDone)
    setSaveError(null)
    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/lesson-progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedTaskIds: Array.from(nextDone) }),
      })
      if (!response.ok) throw new Error('Could not save progress')
      setActiveIndex(firstUnfinishedTaskIndex(tasks, nextDone))
      onComplete?.(task)
    } catch {
      setDone(done)
      setSaveError('Your task was not saved. Please try again.')
    } finally {
      setIsSaving(false)
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
    submitHomework,
  }
}
