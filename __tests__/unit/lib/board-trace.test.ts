import { apply, emptyBoard, type BoardState } from '@/lib/board/reducer'
import { TraceStep } from '@/lib/board/schema'
import { applyClientEvent } from '@/lib/tutor/events'
import { runTurn, type Chunk, type TurnEvent } from '@/lib/tutor/turn'
import { nodeTrace } from '@/__tests__/helpers/pyodide'

jest.setTimeout(60_000)

const boardWithCode = (language = 'python'): BoardState =>
  [
    { op: 'new_page', pageId: 'p1', title: 'One' },
    { op: 'add', pageId: 'p1', node: { id: 'c1', parentId: null, createdBy: 'tutor', type: 'code', language, source: 'x = 1', editable: true, highlightLines: [] } },
  ].reduce((b, op) => apply(b, op), emptyBoard())

describe('_trace (real Pyodide)', () => {
  it('records each line with the variables as they were before it ran', async () => {
    const steps = await nodeTrace('total = 0\nfor n in [1, 2]:\n    total += n\nprint(total)')
    expect(steps.every((s) => TraceStep.safeParse(s).success)).toBe(true)
    expect(steps.map((s) => s.line)).toEqual([1, 2, 3, 2, 3, 2, 4])
    expect(steps[0].vars).toEqual([])
    expect(steps[2].vars.find((v) => v.name === 'total')).toMatchObject({ type: 'int', repr: '0' })
    expect(steps[2].vars.find((v) => v.name === 'n')?.repr).toBe('1')
    expect(steps[1].vars.find((v) => v.name === 'total')).toBeDefined()
    expect(steps.at(-1)!.vars.find((v) => v.name === 'total')?.repr).toBe('3')
  })

  it('gives lists as items, shows the call stack, and captures stdout so far', async () => {
    const steps = await nodeTrace('def hi(a):\n    print(a)\n    return a\nxs = [1, 2, 3]\nhi(xs[0])\nprint("done")')
    expect(steps.find((s) => s.vars.some((v) => v.name === 'xs'))!.vars.find((v) => v.name === 'xs')?.items).toEqual(['1', '2', '3'])
    expect(steps.find((s) => s.line === 3)!.callStack).toEqual(['<module>', 'hi'])
    expect(steps.find((s) => s.line === 3)!.stdout).toBe('1\n')
    expect(steps.at(-1)!.stdout).toBe('1\n')
    expect(steps.some((s) => s.vars.some((v) => v.name === 'hi'))).toBe(false) // functions are not variables
  })

  it('stops an endless loop at 200 steps, and keeps steps up to a crash', async () => {
    expect(await nodeTrace('while True:\n    pass')).toHaveLength(200)
    expect((await nodeTrace('a = 1\nb = a / 0')).map((s) => s.line)).toEqual([1, 2])
  })
})

describe('trace_result event', () => {
  const steps = [{ line: 1, stdout: '', callStack: ['<module>'], vars: [] }]

  it('adds a trace node, then replaces its steps on the next one', () => {
    const first = applyClientEvent(boardWithCode(), { type: 'trace_result', nodeId: 'c1', source: 'x = 2', steps })
    expect(first.board.nodes.trace_c1).toMatchObject({ type: 'trace', forNodeId: 'c1', cursor: 0, createdBy: 'system' })
    expect(first.board.nodes.c1).toMatchObject({ source: 'x = 2' })
    expect(first.content).toContain('trace_ready')
    const again = applyClientEvent({ ...first.board, nodes: { ...first.board.nodes, trace_c1: { ...(first.board.nodes.trace_c1 as object), cursor: 3 } as never } }, { type: 'trace_result', nodeId: 'c1', source: 'x = 2', steps: [] })
    expect(again.board.nodes.trace_c1).toMatchObject({ steps: [], cursor: 0 })
    expect(Object.keys(again.board.nodes).filter((k) => k.startsWith('trace_'))).toHaveLength(1)
  })

  it('rejects a trace for an unknown node', () => {
    expect(() => applyClientEvent(boardWithCode(), { type: 'trace_result', nodeId: 'nope', source: '', steps })).toThrow(/Unknown code node/)
  })
})

describe('request_trace tool', () => {
  const call = (name: string, args: object): AsyncIterable<Chunk> => ({
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c0', function: { name, arguments: JSON.stringify(args) } }] } }] }
    },
  })
  const run = async (board: BoardState, nodeId: string) => {
    const events: TurnEvent[] = []
    const replies = [call('request_trace', { nodeId }), (async function* () { yield { choices: [{ delta: { content: 'ok' } }] } })()]
    await runTurn({ board, messages: [], emit: (e) => events.push(e), llm: async () => replies.shift() as never })
    return events
  }

  it('asks the browser to run the trace for a Python code node', async () => {
    expect(await run(boardWithCode(), 'c1')).toContainEqual({ type: 'trace.request', nodeId: 'c1' })
  })

  it('refuses other languages and unknown nodes without a request', async () => {
    expect((await run(boardWithCode('javascript'), 'c1')).some((e) => e.type === 'trace.request')).toBe(false)
    expect((await run(boardWithCode(), 'zzz')).some((e) => e.type === 'trace.request')).toBe(false)
  })
})
