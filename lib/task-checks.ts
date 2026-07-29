// Executable versions of a lesson task's `success` sentence.
//
// A task is only "done" when the student's file actually shows the change.
// Checks are deliberately shape-tolerant: they compare against the template
// default rather than demanding an exact answer, because there is no single
// right answer to "name your goal".
//
// Every check fails OPEN when it cannot run (no DOM available, bad pattern).
// A broken check must never dead-end an 8-year-old.

export type TaskCheck =
  | {
      // An element's visible text must differ from the starter template text.
      kind: 'textChanged'
      label: string
      hint: string
      selector: string
      from: string
    }
  | {
      // A starter string must no longer appear anywhere in the file.
      kind: 'sourceOmits'
      label: string
      hint: string
      snippet: string
    }
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

export interface TaskCheckResult {
  label: string
  hint: string
  passed: boolean
}

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function parseDocument(code: string): Document | null {
  if (typeof DOMParser === 'undefined') return null
  try {
    return new DOMParser().parseFromString(code, 'text/html')
  } catch {
    return null
  }
}

function evaluate(check: TaskCheck, code: string, doc: Document | null): boolean {
  switch (check.kind) {
    case 'textChanged': {
      if (!doc) return true
      const element = doc.querySelector(check.selector)
      if (!element) return false
      const current = normalize(element.textContent ?? '')
      return current.length > 0 && current !== normalize(check.from)
    }
    case 'sourceOmits':
      return !normalize(code).includes(normalize(check.snippet))
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

export function runTaskChecks(checks: TaskCheck[] | undefined, code: string): TaskCheckResult[] {
  if (!checks?.length) return []
  const needsDom = checks.some((check) => check.kind === 'textChanged')
  const doc = needsDom ? parseDocument(code) : null
  return checks.map((check) => ({
    label: check.label,
    hint: check.hint,
    passed: evaluate(check, code, doc),
  }))
}

export function allChecksPassed(results: TaskCheckResult[]) {
  return results.every((result) => result.passed)
}

export function firstUnmetCheck(results: TaskCheckResult[]) {
  return results.find((result) => !result.passed) ?? null
}
