import { allChecksPassed, echoes, firstUnmetCheck, runTaskChecks } from '@/lib/task-checks'
import type { TaskCheck } from '@/lib/task-checks'

// Language-neutral behaviour of the check evaluator. Coverage of the real
// catalog (no task passes on its starter, every task passes with the solution)
// lives in py-lessons.test.ts, which runs real Pyodide.

const program = 'name = "Sparky"\nprint(name)\n# TASK: greet\nprint("hi")\n'
const match = (pattern: string, min = 1): TaskCheck => ({
  kind: 'sourceMatches',
  pattern,
  min,
  flags: 'm',
  label: 'l',
  hint: 'h',
})

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

// Director weeks: a # note counts only if it says something its line of code does not.
describe("notes in the student's own words (ownWords)", () => {
  const NOTE = '^[ \\t]*[^#\\s][^#\\n]*[ \\t]#[ \\t]*\\S'
  const notes = (min: number) => ({ ...match(NOTE, min), ownWords: true }) as TaskCheck

  it('treats a note that reads its line aloud as an echo', () => {
    expect(echoes('x = 5  # x is 5')).toBe(true)
    expect(echoes('print("Woof!")  # prints Woof')).toBe(true)
    expect(echoes('print("I am Rex")  # print I am Rex')).toBe(true)
    expect(echoes('print("hi")  # print it')).toBe(true)
  })

  it("counts a short note in the student's own words", () => {
    expect(echoes('x = 5  # my score starts at 5')).toBe(false)
    expect(echoes('print("Woof!")  # then he barks at me')).toBe(false)
    expect(echoes('print("Rex is " + str(age))  # age is a number, so I turn it into text')).toBe(
      false
    )
  })

  it('counts only the notes that are not echoes', () => {
    const code = 'name = "Rex"  # name is Rex\nprint(name)  # my pet says hi\n'
    expect(runTaskChecks([notes(1)], code)[0].passed).toBe(true)
    expect(runTaskChecks([notes(2)], code)[0].passed).toBe(false)
    // Without ownWords, the echo still counts: tutor weeks are unchanged.
    expect(runTaskChecks([match(NOTE, 2)], code)[0].passed).toBe(true)
  })
})
