import { emptyBoard } from '@/lib/board/reducer'
import { TOOLS } from '@/lib/board/tools'
import { runTurn, type Chunk, type TurnEvent } from '@/lib/tutor/turn'

// One scripted model reply: optional speech, then tool calls streamed in pieces.
const reply = (text: string, calls: [string, object][] = []): AsyncIterable<Chunk> => ({
  async *[Symbol.asyncIterator]() {
    if (text) yield { choices: [{ delta: { content: text } }] }
    for (const [i, [name, args]] of calls.entries()) {
      const json = JSON.stringify(args)
      yield { choices: [{ delta: { tool_calls: [{ index: i, id: `c${i}`, function: { name, arguments: json.slice(0, 5) } }] } }] }
      yield { choices: [{ delta: { tool_calls: [{ index: i, function: { arguments: json.slice(5) } }] } }] }
    }
  },
})

const run = async (replies: AsyncIterable<Chunk>[]) => {
  const seen: unknown[][] = []
  const events: TurnEvent[] = []
  const queue = [...replies]
  const out = await runTurn({
    board: emptyBoard(),
    messages: [{ role: 'user', content: 'hi' }],
    emit: (e) => events.push(e),
    llm: async (m) => (seen.push(m.map((x) => ({ ...x }))), queue.shift()!),
  })
  return { out, events, calls: seen.length }
}

const heading = { id: 'h1', type: 'heading', text: 'Hello' }

describe('runTurn', () => {
  it('streams captions and applies valid tool calls', async () => {
    const { out, events } = await run([
      reply('Hi!', [['board_new_page', { pageId: 'p1', title: 'One' }], ['board_add', { pageId: 'p1', node: heading }]]),
    ])
    expect(out.text).toBe('Hi!')
    expect(out.board.nodes.h1).toMatchObject({ type: 'heading', createdBy: 'tutor', parentId: null })
    expect(events.filter((e) => e.type === 'board.op')).toHaveLength(2)
    expect(events.at(-1)).toEqual({ type: 'turn.end' })
  })

  it('returns a bad call to the model as a tool result and applies the fix', async () => {
    const { out, calls } = await run([
      reply('', [['board_focus', { id: 'ghost' }]]),
      reply('Fixed.', [['board_new_page', { pageId: 'p1', title: 'One' }]]),
    ])
    expect(calls).toBe(2)
    expect(out.board.pages).toHaveLength(1)
  })

  it('refuses tutor-made output nodes and stops after two retries without crashing', async () => {
    const bad = reply('', [['board_add', { pageId: 'p1', node: { id: 'o1', type: 'output', forNodeId: 'c1', stdout: '', stderr: '', ok: true } }]])
    const { out, calls } = await run([bad, bad, bad, bad])
    expect(calls).toBe(3)
    expect(out.board.nodes).toEqual({})
  })

  it('survives unparseable arguments', async () => {
    const broken: AsyncIterable<Chunk> = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 'x', function: { name: 'board_add', arguments: '{"pageId":' } }] } }] }
      },
    }
    const { out } = await run([broken, reply('ok')])
    expect(out.text).toBe('ok')
  })
})

describe('tool schemas', () => {
  it('never offer client-only node types', () => {
    const json = JSON.stringify(TOOLS)
    for (const t of ['"output"', '"trace"', '"preview"']) expect(json).not.toContain(t)
  })
})
