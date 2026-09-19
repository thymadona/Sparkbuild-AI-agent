import { apply, emptyBoard } from '@/lib/board/reducer'
import { boardCode, boardFromFiles, codeNodeId, withBoardCode, SavedBoard } from '@/lib/board/code'

const withCode = (b: ReturnType<typeof emptyBoard>, id: string, source: string) => {
  const base = b.pages.length ? b : apply(b, { op: 'new_page', pageId: 'p1', title: 'One' })
  return apply(base, { op: 'add', pageId: base.activePageId ?? 'p1', node: { id, parentId: null, createdBy: 'tutor', type: 'code', language: 'python', source, editable: true, highlightLines: [] } })
}

describe('board code', () => {
  it('reads the seeded main node over newer ones, else the newest editable node', () => {
    expect(boardCode(emptyBoard())).toBeNull()
    const two = withCode(withCode(emptyBoard(), 'a', 'one'), 'b', 'two')
    expect(boardCode(two)).toBe('two')
    expect(codeNodeId(withCode(boardFromFiles('mine'), 'b', 'two'))).toBe('main')
  })

  it('ignores object key order (jsonb reorders keys) and follows page order', () => {
    const two = withCode(withCode(emptyBoard(), 'first_long_id', 'one'), 'b', 'two')
    const reordered = { ...two, nodes: { b: two.nodes.b, first_long_id: two.nodes.first_long_id } }
    expect(boardCode(reordered)).toBe('two')
  })

  it('round-trips through files and only writes when there is code', () => {
    const board = boardFromFiles('print(1)')
    expect(boardCode(board)).toBe('print(1)')
    expect(withBoardCode({ 'main.py': 'old', 'bugzap.py': 'x' }, 'main.py', board)).toEqual({ 'main.py': 'print(1)', 'bugzap.py': 'x' })
    const files = { 'main.py': 'old' }
    expect(withBoardCode(files, 'main.py', emptyBoard())).toBe(files)
  })

  it('accepts a real board and rejects a bad node', () => {
    expect(SavedBoard.safeParse(boardFromFiles('x')).success).toBe(true)
    const bad = { ...boardFromFiles('x'), nodes: { main: { id: 'main', type: 'nope' } } }
    expect(SavedBoard.safeParse(bad).success).toBe(false)
  })
})
