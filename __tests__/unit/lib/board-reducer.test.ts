import { apply, emptyBoard, summarize } from '@/lib/board/reducer'

const code = (id: string) => ({
  id, parentId: null, createdBy: 'tutor', type: 'code', language: 'python',
  source: 'print("hi")', editable: true,
})
const withPage = () => apply(emptyBoard(), { op: 'new_page', pageId: 'p1', title: 'Hello' })

describe('board reducer', () => {
  it('adds, patches and removes a node with its runner output', () => {
    let s = apply(withPage(), { op: 'add', pageId: 'p1', node: code('c1') }, 'tutor')
    s = apply(s, { op: 'add', pageId: 'p1', node: { id: 'o1', parentId: null, createdBy: 'system', type: 'output', forNodeId: 'c1', stdout: 'hi', stderr: '', ok: true } })
    s = apply(s, { op: 'update', id: 'c1', patch: { source: 'print("yo")', highlightLines: [1] } })
    expect(s.nodes.c1).toMatchObject({ source: 'print("yo")', highlightLines: [1] })
    s = apply(s, { op: 'remove', id: 'c1' })
    expect(s.nodes).toEqual({})
    expect(s.pages[0].nodeIds).toEqual([])
  })

  it('rejects tutor-created output nodes', () => {
    const op = { op: 'add', pageId: 'p1', node: { id: 'o1', parentId: null, createdBy: 'tutor', type: 'output', forNodeId: 'c1', stdout: '', stderr: '', ok: true } }
    expect(() => apply(withPage(), op, 'tutor')).toThrow(/cannot create output/)
  })

  it('rejects unknown ids, bad patches and identity rewrites', () => {
    const s = apply(withPage(), { op: 'add', pageId: 'p1', node: code('c1') })
    expect(() => apply(s, { op: 'focus', id: 'nope' })).toThrow(/Unknown node/)
    expect(() => apply(s, { op: 'update', id: 'c1', patch: { language: 'ruby' } })).toThrow(/Bad patch/)
    expect(apply(s, { op: 'update', id: 'c1', patch: { type: 'text', id: 'zz' } }).nodes.c1.type).toBe('code')
    expect(() => apply(s, { op: 'add', pageId: 'p9', node: code('c2') })).toThrow(/Unknown page/)
  })

  it('summarizes ids and types for the tutor', () => {
    const s = apply(withPage(), { op: 'add', pageId: 'p1', node: code('c1') })
    expect(summarize(s)).toContain('c1 [code] print("hi")')
  })
})
