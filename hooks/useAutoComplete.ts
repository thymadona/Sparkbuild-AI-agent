'use client'

import { useEffect, useRef } from 'react'
import type { TaskChecks } from '@/hooks/useTaskChecks'

// Checks re-run on every keystroke, so a task can pass mid-thought. Wait for
// the student to stop typing before taking the page away from them.
export const SETTLE_MS = 800

interface Args {
  // False on a board with no lesson, where there is nothing to complete.
  enabled: boolean
  taskId: string | undefined
  done: boolean
  saving: boolean
  checks: TaskChecks
  // Restarts the settle timer, so the advance lands after the student pauses.
  code: string
  complete: () => void
}

/**
 * The task completes itself once its checks pass — the board has no Mark done
 * button. `evaluated` is required as well as `satisfied`: a task carrying no
 * checks reads as satisfied, and auto-completing those would march a student
 * through a whole lesson they never did.
 */
export function useAutoComplete({ enabled, taskId, done, saving, checks, code, complete }: Args) {
  // One attempt per task per version of the code. The server has the last word
  // and can refuse (it checks the code it has stored), so an edit must be able
  // to try again — while unchanged code must not retry in a loop.
  const fired = useRef<{ taskId: string; code: string } | null>(null)
  const completeRef = useRef(complete)
  completeRef.current = complete

  useEffect(() => {
    if (!enabled || !taskId || done || saving) return
    if (!checks.evaluated || !checks.satisfied) return
    if (fired.current?.taskId === taskId && fired.current.code === code) return
    const timer = setTimeout(() => {
      fired.current = { taskId, code }
      completeRef.current()
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [enabled, taskId, done, saving, checks.evaluated, checks.satisfied, code])
}
