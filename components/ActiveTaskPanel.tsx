'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LessonTask } from '@/lib/lessons'
import { allChecksPassed, runTaskChecks } from '@/lib/task-checks'
import { SCALE } from '@/lib/lesson-ui'

interface ActiveTaskPanelProps {
  task: LessonTask
  code: string
  isSaving: boolean
  saveError: string | null
  onMarkDone: () => void
}

/**
 * The detail panel for whichever task is active. The student clicks Mark
 * done themselves; the button just stays disabled until their code satisfies
 * the task's checks. Shared by the Tasks and Homework side panels since a
 * student can only ever be actively working one task at a time.
 */
export default function ActiveTaskPanel({ task, code, isSaving, saveError, onMarkDone }: ActiveTaskPanelProps) {
  // Checks need a DOM, so they cannot run during server rendering. Evaluating
  // them only after mount keeps the server and first client render identical —
  // otherwise the fail-open path reports every check as passed on the server and
  // React throws a hydration mismatch.
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const hasChecks = (task.checks?.length ?? 0) > 0
  const checkResults = useMemo(() => (mounted ? runTaskChecks(task.checks, code) : []), [mounted, task.checks, code])
  const checksEvaluated = hasChecks && checkResults.length > 0
  const checksSatisfied = !hasChecks || (checksEvaluated && allChecksPassed(checkResults))

  return (
    <div className="shrink-0 border-t-2 border-surface-600 p-3">
      {saveError && <p className={`mb-2 text-center ${SCALE.check} text-red-500`}>{saveError}</p>}

      {hasChecks && !checksEvaluated && (
        <p className={`mb-2 text-center ${SCALE.check} text-fg-muted`}>Checking your code…</p>
      )}

      <button
        onClick={onMarkDone}
        disabled={isSaving || !checksSatisfied}
        className={`w-full rounded-lg border-2 border-surface-600 px-3 py-1.5 ${SCALE.button} font-bold shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-hard-sm ${
          checksSatisfied ? 'bg-teal-500 hover:bg-teal-400 text-white' : 'bg-surface-600 text-fg-secondary'
        }`}
      >
        {isSaving ? 'Saving…' : checksSatisfied ? 'Mark done ✓' : 'Not yet — keep going'}
      </button>
    </div>
  )
}
