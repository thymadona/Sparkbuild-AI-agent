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
      // The match only proves it is there; the tutor judges whether it is good
      // (director weeks: the student's "# ask:" line, mission rule 4).
      judged?: boolean
      // Count only lines whose # note says something beyond the code (see `echoes`).
      ownWords?: boolean
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

// A check the tutor must judge beyond "it is there", and what it is told about it.
export const judged = (check: TaskCheck) => check.kind === 'sourceMatches' && !!check.judged
export const JUDGED = 'found; you judge if it is clear (see the explain rule at the end).'

export function isRuntimeCheck(check: TaskCheck): check is RuntimeCheck {
  return (
    check.kind === 'outputContains' ||
    check.kind === 'callReturns' ||
    check.kind === 'worldContains'
  )
}

// Words a note may add without explaining anything: "# prints Woof" still reads the code aloud.
const FILLER = new Set(
  'a an the is are it its to and then of this that print prints printed say says said show shows set sets make makes line'.split(
    ' '
  )
)
const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? []

// A "code  # note" line whose note only repeats the code: every word of the note, apart
// from FILLER, is already in the code (x = 5  # x is 5). The code part of a NOTE line has
// no #, so the first # starts the note.
export function echoes(line: string): boolean {
  const at = line.indexOf('#')
  if (at < 0) return false
  const code = new Set(words(line.slice(0, at)))
  return words(line.slice(at + 1)).every((w) => FILLER.has(w) || code.has(w))
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
        if (check.ownWords) {
          const one = new RegExp(check.pattern, flags.replace('g', ''))
          const own = code.split('\n').filter((line) => one.test(line) && !echoes(line))
          return own.length >= (check.min ?? 1)
        }
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
  runtime: RuntimeVerdicts = []
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
