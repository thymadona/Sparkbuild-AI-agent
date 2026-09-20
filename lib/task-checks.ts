// Executable versions of a lesson task's `success` sentence.
//
// A task is only "done" when the student's program actually shows the change.
// Checks are deliberately shape-tolerant: they match the source loosely or run
// it, rather than demanding exact words, because there is no single right
// answer to "give Sparky a name".
//
// Every check fails OPEN when it cannot run (bad pattern). A broken check must
// never dead-end a child.

export type TaskCheck =
  | {
      // The file must contain at least `min` matches of a pattern.
      kind: 'sourceMatches'
      label: string
      hint: string
      pattern: string
      flags?: string
      min?: number
      // A snippet that satisfies this check. Documents the expected shape and
      // lets tests prove the check is actually reachable.
      example?: string
    }
  | RuntimeCheck

// Runtime checks run the student's Python (lib/python-checks.ts), so they are
// async and live in the browser. `runTaskChecks` is sync, so it takes their
// verdicts as input: true/false per check, or undefined while still running.
export type RuntimeVerdicts = Array<boolean | undefined>

export type RuntimeCheck =
  | {
      // Runs the entry file (fed `inputs` for input()); it must finish
      // without an error and print something matching `pattern`.
      kind: 'outputContains'
      label: string
      hint: string
      pattern: string
      flags?: string
      inputs?: string[]
      file?: string
    }
  | {
      // Like outputContains, but matches what happened in Sparky's world
      // (lib/sparky-events.ts): "say:Hi", "color:pink", "door:open", "alarm".
      kind: 'worldContains'
      label: string
      hint: string
      pattern: string
      flags?: string
      inputs?: string[]
      file?: string
    }
  | {
      // Loads the file (without running `if __name__ == '__main__'`) and
      // evaluates `call`; repr() of the result must equal `equals`.
      kind: 'callReturns'
      label: string
      hint: string
      call: string
      equals: string
      file?: string
    }

export function isRuntimeCheck(check: TaskCheck): check is RuntimeCheck {
  return check.kind === 'outputContains' || check.kind === 'callReturns' || check.kind === 'worldContains'
}

export interface TaskCheckResult {
  label: string
  hint: string
  passed: boolean
}

function evaluate(check: TaskCheck, code: string, verdict: boolean | undefined): boolean {
  switch (check.kind) {
    case 'outputContains':
    case 'worldContains':
    case 'callReturns':
      return verdict ?? false
    case 'sourceMatches': {
      const flags = check.flags?.includes('g') ? check.flags : `${check.flags ?? ''}g`
      try {
        const matches = code.match(new RegExp(check.pattern, flags))
        return (matches?.length ?? 0) >= (check.min ?? 1)
      } catch {
        return true
      }
    }
  }
}

export function runTaskChecks(
  checks: TaskCheck[] | undefined,
  code: string,
  runtime: RuntimeVerdicts = [],
): TaskCheckResult[] {
  if (!checks?.length) return []
  return checks.map((check, i) => ({
    label: check.label,
    hint: check.hint,
    passed: evaluate(check, code, runtime[i]),
  }))
}

export function allChecksPassed(results: TaskCheckResult[]) {
  return results.every((result) => result.passed)
}

export function firstUnmetCheck(results: TaskCheckResult[]) {
  return results.find((result) => !result.passed) ?? null
}

// Every line the student actually needs to touch for a task: the anchor
// comment plus every line a static check's pattern matches. A pattern that
// matches nothing just contributes nothing — same fail-open spirit as evaluate().
export function highlightLinesForTask(code: string, commentAnchor: string, checks?: TaskCheck[]): number[] {
  const lines = code.split('\n')
  const found = new Set<number>()

  const anchorLine = lines.findIndex((line) => line.includes(commentAnchor))
  if (anchorLine >= 0) found.add(anchorLine + 1)

  for (const check of checks ?? []) {
    if (check.kind === 'sourceMatches') {
      lines.forEach((line, i) => {
        try {
          if (new RegExp(check.pattern, check.flags).test(line)) found.add(i + 1)
        } catch {
          // bad pattern — fail open, no extra line
        }
      })
    }
  }

  return Array.from(found).sort((a, b) => a - b)
}
