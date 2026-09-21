import { allChecksPassed, firstUnmetCheck, runTaskChecks } from '@/lib/task-checks'
import type { TaskCheck } from '@/lib/task-checks'

// Language-neutral behaviour of the check evaluator. Coverage of the real
// catalog (no task passes on its starter, every task passes with the solution)
// lives in py-lessons.test.ts, which runs real Pyodide.

const program = 'name = "Sparky"\nprint(name)\n# TASK: greet\nprint("hi")\n'
const match = (pattern: string, min = 1): TaskCheck => ({ kind: 'sourceMatches', pattern, min, flags: 'm', label: 'l', hint: 'h' })

describe('runTaskChecks', () => {
  it('returns no checks for a task that has none', () => {
    expect(runTaskChecks(undefined, program)).toEqual([])
  })

  it('counts sourceMatches occurrences against min', () => {
    expect(runTaskChecks([match('^print\\(', 2)], program)[0].passed).toBe(true)
    expect(runTaskChecks([match('^print\\(', 3)], program)[0].passed).toBe(false)
  })

  it('takes runtime verdicts by position and treats a missing one as unmet', () => {
    const checks: TaskCheck[] = [
      match('^name ='),
      { kind: 'outputContains', pattern: 'Sparky', label: 'says', hint: 'h' },
      { kind: 'callReturns', call: 'f()', equals: 'True', label: 'calls', hint: 'h' },
    ]
    const results = runTaskChecks(checks, program, [undefined, true, undefined])
    expect(results.map((r) => r.passed)).toEqual([true, true, false])
    expect(allChecksPassed(results)).toBe(false)
    expect(firstUnmetCheck(results)?.label).toBe('calls')
  })

  it('fails open on an invalid pattern instead of blocking the student', () => {
    expect(runTaskChecks([match('([unclosed')], program)[0].passed).toBe(true)
  })
})

