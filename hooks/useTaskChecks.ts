'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LessonTask } from '@/lib/lessons'
import { allChecksPassed, runTaskChecks, type TaskCheckResult } from '@/lib/task-checks'
import type { RuntimeChecks } from '@/hooks/useRuntimeChecks'

export interface TaskChecks {
  results: TaskCheckResult[]
  // False while the checks have not produced a verdict yet, so the caller can
  // say "checking…" instead of "not done".
  evaluated: boolean
  satisfied: boolean
}

/**
 * The live verdict on the active task, static checks and Pyodide checks
 * combined. Lifted out of ActiveTaskPanel because the board acts on this
 * rather than just rendering a button from it: passing every check is what
 * completes the task and opens the next page.
 */
export function useTaskChecks(
  task: LessonTask | undefined,
  code: string,
  runtime: RuntimeChecks | null
): TaskChecks {
  // Checks need a DOM, so they cannot run during server rendering. Evaluating
  // them only after mount keeps the server and first client render identical —
  // otherwise the fail-open path reports every check as passed on the server
  // and React throws a hydration mismatch. It matters more here than it did in
  // the panel: a false pass now completes the task by itself.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Verdicts are tagged with the task they were computed for, so a stale
  // result from the previous task can never complete the next one.
  const runtimeVerdicts = runtime && runtime.taskId === task?.id ? runtime.verdicts : undefined

  const hasChecks = (task?.checks?.length ?? 0) > 0
  const results = useMemo(
    () => (mounted && task ? runTaskChecks(task.checks, code, runtimeVerdicts) : []),
    [mounted, task, code, runtimeVerdicts]
  )
  const evaluated = hasChecks && results.length > 0

  return { results, evaluated, satisfied: !hasChecks || (evaluated && allChecksPassed(results)) }
}
