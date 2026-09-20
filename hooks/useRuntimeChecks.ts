'use client'

import { useEffect, useState } from 'react'
import type { LessonTask } from '@/lib/lessons'
import { isRuntimeCheck, type RuntimeVerdicts } from '@/lib/task-checks'
import { runPythonChecks } from '@/lib/python-checks'
import { workerExec } from '@/lib/python-check-client'

const DEBOUNCE_MS = 800

export interface RuntimeChecks {
  taskId: string
  verdicts: RuntimeVerdicts
}

// Runs the active task's Python checks a moment after the student stops
// typing. Returns verdicts tagged with the task they belong to, so a stale
// result from the previous task can never be applied to the next one.
export function useRuntimeChecks(
  task: LessonTask | undefined,
  files: Record<string, string>,
  entry: string,
): RuntimeChecks | null {
  const [result, setResult] = useState<RuntimeChecks | null>(null)
  const hasRuntime = !!task?.checks?.some(isRuntimeCheck)

  useEffect(() => {
    if (!task || !hasRuntime) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const verdicts = await runPythonChecks(task.checks ?? [], files, entry, workerExec).catch(() => null)
      if (!cancelled && verdicts) setResult({ taskId: task.id, verdicts })
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [task, hasRuntime, files, entry])

  return task && result?.taskId === task.id ? result : null
}
