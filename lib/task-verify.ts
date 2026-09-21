import type { LessonTask } from '@/lib/lessons'
import type { BoardState } from '@/lib/board/reducer'
import { boardCode, pageCode } from '@/lib/board/code'
import { taskPageId } from '@/lib/board/tasks'
import {
  isRuntimeCheck,
  runTaskChecks,
  type RuntimeVerdicts,
  type TaskCheckResult,
} from '@/lib/task-checks'

// The code a task is judged on, read from what the server has persisted — never
// from anything the caller sent. A task owns one board page, so that page's
// code node is the answer; older boards with no task pages fall back.
export function taskCode(
  board: BoardState | null,
  files: Record<string, string>,
  entry: string,
  task: LessonTask
): string {
  if (board) {
    const own = pageCode(board, taskPageId(task))
    if (own !== null) return own
    const any = boardCode(board)
    if (any !== null) return any
  }
  return files[entry] ?? ''
}

export interface Verdict {
  results: TaskCheckResult[]
  passed: boolean
  // The first unmet check, for a refusal the student can act on.
  failed: TaskCheckResult | null
}

/**
 * Whether a task is really finished. Static checks are recomputed here and are
 * authoritative; runtime checks need Python, which only the student's browser
 * runs, so their verdicts are taken as reported. runTaskChecks ignores a
 * reported verdict for any non-runtime check, so a caller cannot use them to
 * wave a static check through.
 */
export function verifyTask(
  task: LessonTask,
  code: string,
  reported: RuntimeVerdicts = []
): Verdict {
  const verdicts = (task.checks ?? []).map((check, i) =>
    isRuntimeCheck(check) ? reported[i] : undefined
  )
  const results = runTaskChecks(task.checks, code, verdicts)
  return {
    results,
    passed: results.every((r) => r.passed),
    failed: results.find((r) => !r.passed) ?? null,
  }
}
