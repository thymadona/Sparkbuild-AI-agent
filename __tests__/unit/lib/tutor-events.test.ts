import { ClientEvent, applyClientEvent } from '@/lib/tutor/events'
import { apply, emptyBoard } from '@/lib/board/reducer'

const board = apply(
  apply(emptyBoard(), { op: 'new_page', pageId: 'p1', title: 'One' }),
  {
    op: 'add',
    pageId: 'p1',
    node: {
      id: 'bolt_1',
      parentId: null,
      createdBy: 'system',
      type: 'helper',
      request: 'make a game',
      source: 'print("game")',
    },
  },
  'bolt'
)

describe('helper_result', () => {
  it("parses, and tells Sparky the request and Bolt's code", () => {
    const ev = ClientEvent.parse({ type: 'helper_result', nodeId: 'bolt_1' })
    const { content, saveText, board: after } = applyClientEvent(board, ev)
    expect(content).toContain('<helper_event>')
    expect(content).toContain('make a game')
    expect(content).toContain('print(\\"game\\")')
    expect(saveText).toBeUndefined()
    expect(after).toBe(board)
  })

  it('rejects an unknown node or one that is not a Bolt block', () => {
    expect(ClientEvent.safeParse({ type: 'helper_result', nodeId: 'bad id' }).success).toBe(false)
    expect(() => applyClientEvent(board, { type: 'helper_result', nodeId: 'nope' })).toThrow(
      /Unknown Bolt block/
    )
    const withCode = apply(board, {
      op: 'add',
      pageId: 'p1',
      node: {
        id: 'c1',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source: '',
        editable: true,
      },
    })
    expect(() => applyClientEvent(withCode, { type: 'helper_result', nodeId: 'c1' })).toThrow(
      /Unknown Bolt block/
    )
  })
})
