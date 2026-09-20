import { PyUnavailable, runPythonChecks, type PyExec } from '@/lib/python-checks'
import { allChecksPassed, runTaskChecks, type TaskCheck } from '@/lib/task-checks'
import { nodeExec } from '@/__tests__/helpers/pyodide'

jest.setTimeout(60_000)

const say = (pattern: string, inputs?: string[]): TaskCheck => ({
  kind: 'outputContains', label: 'says it', hint: 'h', pattern, inputs,
})
const call = (expr: string, equals: string): TaskCheck => ({
  kind: 'callReturns', label: 'returns it', hint: 'h', call: expr, equals,
})
const verdicts = (checks: TaskCheck[], main: string, extra: Record<string, string> = {}) =>
  runPythonChecks(checks, { 'main.py': main, ...extra }, 'main.py', nodeExec)

describe('outputContains', () => {
  it('passes when the program prints a match', async () => {
    expect(await verdicts([say('^hello')], 'print("hello robot")')).toEqual([true])
  })

  it('fails on other output and on the untouched starter', async () => {
    expect(await verdicts([say('^hello')], 'print("beep boop")')).toEqual([false])
    expect(await verdicts([say('^hello')], '# TASK: first words\n')).toEqual([false])
  })

  it('fails when the program crashes, even if the text was printed first', async () => {
    expect(await verdicts([say('hello')], 'print("hello")\nprint(1/0)')).toEqual([false])
  })

  it('feeds inputs to input()', async () => {
    expect(await verdicts([say('hi Ada', ['Ada'])], 'n = input("name? ")\nprint("hi", n)')).toEqual([true])
  })

  it('treats input() with no answers as a failed check, not a hang', async () => {
    expect(await verdicts([say('x')], 'input()')).toEqual([false])
  })

  it('fails open on a bad pattern', async () => {
    expect(await verdicts([say('(')], 'print(1)')).toEqual([true])
  })
})

describe('callReturns', () => {
  const fn = 'def double(n):\n    return n * 2\n'

  it('compares repr of the result', async () => {
    expect(await verdicts([call('double(4)', '8'), call('double("a")', "'aa'")], fn)).toEqual([true, true])
  })

  it('fails on a wrong value, a missing function and a None result', async () => {
    expect(await verdicts([call('double(4)', '9')], fn)).toEqual([false])
    expect(await verdicts([call('double(4)', '8')], 'x = 1')).toEqual([false])
    expect(await verdicts([call('double(4)', '8')], 'def double(n):\n    print(n * 2)')).toEqual([false])
  })

  it('does not run the __main__ block, so input() there cannot block', async () => {
    const src = fn + 'if __name__ == "__main__":\n    input()\n'
    expect(await verdicts([call('double(2)', '4')], src)).toEqual([true])
  })

  it('sees other project files', async () => {
    const src = 'import helpers\ndef shout(s):\n    return helpers.up(s)\n'
    expect(await verdicts([call('shout("a")', "'A'")], src, { 'helpers.py': 'def up(s):\n    return s.upper()\n' })).toEqual([true])
  })

  it('uses fresh module state on each check', async () => {
    const files = { 'helpers.py': 'X = 1\n' }
    expect(await verdicts([call('helpers.X', '1')], 'import helpers', files)).toEqual([true])
    expect(await verdicts([call('helpers.X', '2')], 'import helpers', { 'helpers.py': 'X = 2\n' })).toEqual([true])
  })
})

describe('runPythonChecks', () => {
  it('leaves static checks undefined so indexes line up', async () => {
    const static_: TaskCheck = { kind: 'sourceMatches', label: 's', hint: 'h', pattern: 'x' }
    expect(await verdicts([static_, say('a')], 'print("a")')).toEqual([undefined, true])
  })

  it('fails open when Python cannot start', async () => {
    const broken: PyExec = { run: () => Promise.reject(new PyUnavailable()), call: () => Promise.reject(new PyUnavailable()) }
    expect(await runPythonChecks([say('a'), call('f()', '1')], { 'main.py': '' }, 'main.py', broken)).toEqual([true, true])
  })

  it('rethrows unexpected errors instead of hiding them', async () => {
    const buggy: PyExec = { run: () => Promise.reject(new Error('boom')), call: () => Promise.reject(new Error('boom')) }
    await expect(runPythonChecks([say('a')], {}, 'main.py', buggy)).rejects.toThrow('boom')
  })
})

describe('runTaskChecks with runtime verdicts', () => {
  const checks: TaskCheck[] = [{ kind: 'sourceMatches', label: 'a', hint: 'h', pattern: 'print' }, say('x')]

  it('treats a verdict that is still running as not passed', () => {
    expect(allChecksPassed(runTaskChecks(checks, 'print(1)'))).toBe(false)
    expect(allChecksPassed(runTaskChecks(checks, 'print(1)', [undefined, undefined]))).toBe(false)
  })

  it('combines static results with runtime verdicts by index', () => {
    expect(runTaskChecks(checks, 'print(1)', [undefined, true]).map((r) => r.passed)).toEqual([true, true])
    expect(runTaskChecks(checks, 'nothing', [undefined, true]).map((r) => r.passed)).toEqual([false, true])
  })
})

describe('Sparky world', () => {
  const world = (pattern: string): TaskCheck => ({ kind: 'worldContains', label: 'l', hint: 'h', pattern, flags: 'm' })

  it('records every printed line as speech, in order with sparky actions', async () => {
    const src = 'import sparky\nprint("hi")\nsparky.open_door()\nprint("bye")\nsparky.color("pink")\nsparky.alarm()\n'
    const { ok, stdout, events } = await nodeExec.run({ 'main.py': src }, 'main.py', [])
    expect(ok).toBe(true)
    expect(stdout).toBe('hi\nbye\n') // printing still works normally
    expect(events).toEqual([['say', 'hi'], ['door', 'open'], ['say', 'bye'], ['color', 'pink'], ['alarm', '']])
  })

  it('starts each run with a clean world and skips blank lines', async () => {
    await nodeExec.run({ 'main.py': 'print("first")' }, 'main.py', [])
    const { events } = await nodeExec.run({ 'main.py': 'print()\nprint("second")' }, 'main.py', [])
    expect(events).toEqual([['say', 'second']])
  })

  it('checks what happened in the world, and fails when the run crashes', async () => {
    expect(await verdicts([world('^door:open$')], 'import sparky\nsparky.open_door()')).toEqual([true])
    expect(await verdicts([world('^door:open$')], 'import sparky\nsparky.close_door()')).toEqual([false])
    expect(await verdicts([world('^say:Hi Ada$')], 'print("Hi Ada")')).toEqual([true])
    expect(await verdicts([world('^alarm$')], 'import sparky\nsparky.alarm()\n1/0')).toEqual([false])
  })

  it('reports a bad sparky call on the student’s line, not in the toolbox', async () => {
    const { ok, stdout } = await nodeExec.run({ 'main.py': 'import sparky\nsparky.color()' }, 'main.py', [])
    expect(ok).toBe(false)
    expect(stdout).toBe('')
  })
})
