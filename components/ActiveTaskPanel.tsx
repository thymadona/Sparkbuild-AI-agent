'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LessonTask } from '@/lib/lessons'
import { allChecksPassed, runTaskChecks } from '@/lib/task-checks'
import { SCALE } from '@/lib/lesson-ui'

interface ActiveTaskPanelProps {
  task: LessonTask
  code: string
  kidMode: boolean
  isSaving: boolean
  saveError: string | null
  onMarkDone: () => void
}

/**
 * The detail panel for whichever task is active. There is nothing to click:
 * the moment the student's code satisfies the task's checks, it marks itself
 * done. Shared by the Tasks and Homework side panels since a student can only
 * ever be actively working one task at a time.
 */
export default function ActiveTaskPanel({ task, code, kidMode, isSaving, saveError, onMarkDone }: ActiveTaskPanelProps) {
  // Checks need a DOM, so they cannot run during server rendering. Evaluating
  // them only after mount keeps the server and first client render identical —
  // otherwise the fail-open path reports every check as passed on the server and
  // React throws a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  // Guards against re-firing onMarkDone on every keystroke: this panel
  // re-renders whenever `code` changes, so without a guard a satisfied task
  // would fire a fresh save request on every render.
  const calledRef = useRef(false)

  const type = kidMode ? SCALE.kid : SCALE.pro

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    calledRef.current = false
  }, [task.id])

  // A failed save clears the guard after a short backoff so it retries
  // automatically — there is no button left for the student to click again.
  // The delay keeps a persistent failure from hammering the endpoint in a
  // tight synchronous retry loop.
  useEffect(() => {
    if (!saveError) return
    const timer = setTimeout(() => { calledRef.current = false }, 3000)
    return () => clearTimeout(timer)
  }, [saveError])

  const hasChecks = (task.checks?.length ?? 0) > 0
  const checkResults = useMemo(() => (mounted ? runTaskChecks(task.checks, code) : []), [mounted, task.checks, code])
  const checksEvaluated = hasChecks && checkResults.length > 0
  const checksSatisfied = !hasChecks || (checksEvaluated && allChecksPassed(checkResults))

  useEffect(() => {
    if (checksSatisfied && !isSaving && !calledRef.current) {
      calledRef.current = true
      onMarkDone()
    }
  }, [checksSatisfied, isSaving, onMarkDone])

  return (
    <div className="shrink-0 border-t border-surface-600 p-3">
      {saveError && <p className={`mb-2 text-center ${type.check} text-red-500`}>{saveError}</p>}

      {hasChecks && !checksEvaluated && (
        <p className={`mb-2 text-center ${type.check} text-fg-muted`}>Checking your code…</p>
      )}

      {hasChecks && checksEvaluated && !checksSatisfied && (
        <p className={`mb-2 text-center ${type.check} text-fg-muted`}>
          Keep going — <span className="text-fg-secondary">{task.chip}</span> marks itself done once your code matches.
        </p>
      )}

      {isSaving && (
        <p className={`text-center ${type.check} text-fg-muted`}>Saving…</p>
      )}
    </div>
  )
}
