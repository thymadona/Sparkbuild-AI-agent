import { allChecksPassed, firstUnmetCheck, highlightLinesForTask, runTaskChecks } from '@/lib/task-checks'
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

describe('highlightLinesForTask', () => {
  it('returns only the anchor line when there are no checks', () => {
    expect(highlightLinesForTask('a\nb\nTASK: x\nc', 'TASK: x')).toEqual([3])
  })

  it('returns nothing when the anchor is missing and no check resolves', () => {
    expect(highlightLinesForTask('a\nb\nc', 'TASK: missing')).toEqual([])
  })

  it('finds every line a sourceMatches pattern matches, not just the first', () => {
    expect(highlightLinesForTask('foo\nbar\nfoo', 'TASK: none', [match('foo')])).toEqual([1, 3])
  })

  it('dedupes the anchor line against a check that matches it', () => {
    expect(highlightLinesForTask(program, 'TASK: greet', [match('TASK'), match('^print')])).toEqual([2, 3, 4])
  })

  it('fails open on a malformed pattern instead of throwing', () => {
    expect(() => highlightLinesForTask('TASK: x\nfoo', 'TASK: x', [match('([unclosed')])).not.toThrow()
    expect(highlightLinesForTask('TASK: x\nfoo', 'TASK: x', [match('([unclosed')])).toEqual([1])
  })
})
