import { worldTranscript, type SparkyEvent } from './sparky-events'
import {
  isRuntimeCheck,
  type RuntimeCheck,
  type RuntimeVerdicts,
  type TaskCheck,
} from './task-checks'

export interface PyExec {
  // Run `entry` as a script, feeding `inputs` to input(). ok=false on an error.
  run(
    files: Record<string, string>,
    entry: string,
    inputs: string[]
  ): Promise<{ ok: boolean; stdout: string; events: SparkyEvent[] }>
  // Load `entry` as a module and return repr(eval(expr)); null on any error.
  call(files: Record<string, string>, entry: string, expr: string): Promise<string | null>
}

// Thrown by a PyExec when Python itself cannot start (offline, blocked CDN).
// Checks then fail OPEN — a broken runtime must never dead-end a student.
export class PyUnavailable extends Error {}

async function evaluate(
  check: RuntimeCheck,
  files: Record<string, string>,
  entry: string,
  exec: PyExec
) {
  const file = check.file ?? entry
  if (check.kind === 'callReturns')
    return (await exec.call(files, file, check.call)) === check.equals
  const { ok, stdout, events } = await exec.run(files, file, check.inputs ?? [])
  if (!ok) return false
  try {
    return new RegExp(check.pattern, check.flags).test(
      check.kind === 'worldContains' ? worldTranscript(events) : stdout
    )
  } catch {
    return true // bad pattern: fail open
  }
}

// Verdicts line up with `checks` by index; static checks stay undefined.
export async function runPythonChecks(
  checks: TaskCheck[],
  files: Record<string, string>,
  entry: string,
  exec: PyExec
): Promise<RuntimeVerdicts> {
  const verdicts: RuntimeVerdicts = []
  for (const [i, check] of checks.entries()) {
    if (!isRuntimeCheck(check)) continue
    try {
      verdicts[i] = await evaluate(check, files, entry, exec)
    } catch (e) {
      if (!(e instanceof PyUnavailable)) throw e
      verdicts[i] = true
    }
  }
  return verdicts
}
