import { apply, emptyBoard, summarize } from '@/lib/board/reducer'
import { toolsFor } from '@/lib/board/tools'

const code = (id: string) => ({
  id,
  parentId: null,
  createdBy: 'tutor',
  type: 'code',
  language: 'python',
  source: 'print("hi")',
  editable: true,
})
const withPage = () => apply(emptyBoard(), { op: 'new_page', pageId: 'p1', title: 'Hello' })

describe('board reducer', () => {
  it('adds, patches and removes a node with its runner output', () => {
    let s = apply(withPage(), { op: 'add', pageId: 'p1', node: code('c1') }, 'tutor')
    s = apply(s, {
      op: 'add',
      pageId: 'p1',
      node: {
        id: 'o1',
        parentId: null,
        createdBy: 'system',
        type: 'output',
        forNodeId: 'c1',
        stdout: 'hi',
        stderr: '',
        ok: true,
      },
    })
    s = apply(s, { op: 'update', id: 'c1', patch: { source: 'print("yo")' } })
    expect(s.nodes.c1).toMatchObject({ source: 'print("yo")' })
    s = apply(s, { op: 'remove', id: 'c1' })
    expect(s.nodes).toEqual({})
    expect(s.pages[0].nodeIds).toEqual([])
  })

  it('rejects tutor-created output nodes', () => {
    const op = {
      op: 'add',
      pageId: 'p1',
      node: {
        id: 'o1',
        parentId: null,
        createdBy: 'tutor',
        type: 'output',
        forNodeId: 'c1',
        stdout: '',
        stderr: '',
        ok: true,
      },
    }
    expect(() => apply(withPage(), op, 'tutor')).toThrow(/cannot create output/)
  })

  it('rejects unknown ids, bad patches and identity rewrites', () => {
    const s = apply(withPage(), { op: 'add', pageId: 'p1', node: code('c1') })
    expect(() => apply(s, { op: 'focus', id: 'nope' })).toThrow(/Unknown node/)
    expect(() => apply(s, { op: 'update', id: 'c1', patch: { language: 'ruby' } })).toThrow(
      /Bad patch/
    )
    expect(
      apply(s, { op: 'update', id: 'c1', patch: { type: 'text', id: 'zz' } }).nodes.c1.type
    ).toBe('code')
    expect(() => apply(s, { op: 'add', pageId: 'p9', node: code('c2') })).toThrow(/Unknown page/)
  })

  it('summarizes ids and types for the tutor', () => {
    const s = apply(withPage(), { op: 'add', pageId: 'p1', node: code('c1') })
    expect(summarize(s)).toContain('c1 [code] print("hi")')
  })

  describe('lesson steps', () => {
    const quiz = {
      id: 'q1',
      parentId: null,
      createdBy: 'system',
      type: 'quiz',
      kind: 'multiple_choice',
      prompt: 'Which?',
      options: ['a', 'b'],
      answer: 1,
      picked: null,
      attempts: 0,
      answered: false,
    }
    const boardWithQuiz = () => apply(withPage(), { op: 'add', pageId: 'p1', node: quiz }, 'client')

    it('lets the client record an answer', () => {
      const s = apply(
        boardWithQuiz(),
        { op: 'update', id: 'q1', patch: { picked: 1, attempts: 1, answered: true } },
        'client'
      )
      expect(s.nodes.q1).toMatchObject({ picked: 1, attempts: 1, answered: true })
    })

    it('stops the tutor answering a step for the student', () => {
      // Otherwise Spark could open the editor gate the lesson keeps shut.
      for (const patch of [{ answered: true }, { picked: 1 }, { seen: ['x'] }]) {
        expect(() => apply(boardWithQuiz(), { op: 'update', id: 'q1', patch }, 'tutor')).toThrow(
          /cannot change/
        )
      }
      expect(
        apply(boardWithQuiz(), { op: 'update', id: 'q1', patch: { prompt: 'Which one?' } }, 'tutor')
          .nodes.q1
      ).toMatchObject({ prompt: 'Which one?' })
    })

    it('keeps sandbox nodes away from the tutor', () => {
      const sandbox = {
        id: 's1',
        parentId: null,
        createdBy: 'tutor',
        type: 'sandbox',
        prompt: 'Try',
        template: 'print("{}")',
      }
      expect(() => apply(withPage(), { op: 'add', pageId: 'p1', node: sandbox }, 'tutor')).toThrow(
        /cannot create sandbox/
      )
      const offered = JSON.stringify(toolsFor(true))
      expect(offered).not.toContain('sandbox')
    })

    it('keeps the new step nodes and their state away from the tutor', () => {
      const shapes = {
        stage: {
          prompt: 'P',
          scene: 'room',
          palette: [{ label: 'a', ops: ['say:a'] }],
          solution: [0],
        },
        learn: { prompt: 'P', frames: [{ code: 'c', say: 's' }] },
        order: { prompt: 'P', lines: ['a', 'b'] },
        bug: { prompt: 'P', code: 'a', bugLine: 0, explain: 'e' },
        match: {
          prompt: 'P',
          pairs: [
            { left: 'a', right: 'b' },
            { left: 'c', right: 'd' },
          ],
        },
      }
      for (const [type, shape] of Object.entries(shapes)) {
        expect(() =>
          apply(
            withPage(),
            {
              op: 'add',
              pageId: 'p1',
              node: { id: 'x1', parentId: null, createdBy: 'tutor', type, ...shape },
            },
            'tutor'
          )
        ).toThrow(new RegExp(`cannot create ${type}`))
        expect(JSON.stringify(toolsFor(true))).not.toContain(`"${type}"`)
      }
      for (const field of ['frame', 'arranged', 'matched', 'program']) {
        expect(() =>
          apply(boardWithQuiz(), { op: 'update', id: 'q1', patch: { [field]: 1 } }, 'tutor')
        ).toThrow(/cannot change/)
      }
    })

    it('still loads a quiz saved before steps existed', () => {
      const old = {
        id: 'q0',
        parentId: null,
        createdBy: 'tutor',
        type: 'quiz',
        kind: 'multiple_choice',
        prompt: 'Old?',
        options: ['a'],
      }
      expect(
        apply(withPage(), { op: 'add', pageId: 'p1', node: old }, 'tutor').nodes.q0
      ).toMatchObject({ attempts: 0, answered: false })
    })
  })

  describe("Bolt's block", () => {
    const helper = (id = 'b1', source = 'print("hi")') => ({
      id,
      parentId: null,
      createdBy: 'system',
      type: 'helper',
      request: 'say hi',
      source,
    })
    const add = (node: unknown) => ({ op: 'add', pageId: 'p1', node })
    const withHelper = () => apply(withPage(), add(helper()), 'bolt')

    it('only Bolt may add it, and Bolt may add nothing else', () => {
      expect(withHelper().nodes.b1).toMatchObject({ type: 'helper', request: 'say hi' })
      expect(() => apply(withPage(), add(helper()), 'tutor')).toThrow(/Only Bolt/)
      expect(() => apply(withPage(), add(helper()), 'client')).toThrow(/Only Bolt/)
      expect(() => apply(withPage(), add(code('c1')), 'bolt')).toThrow(/Bolt can only/)
      const s = withHelper()
      expect(() => apply(s, { op: 'focus', id: 'b1' }, 'bolt')).toThrow(/Bolt can only/)
      expect(() => apply(s, { op: 'remove', id: 'b1' }, 'bolt')).toThrow(/Bolt can only/)
      expect(() => apply(s, { op: 'update', id: 'b1', patch: { ok: true } }, 'bolt')).toThrow(
        /Bolt can only/
      )
    })

    it('rejects a block over 8 non-blank lines', () => {
      const nine = Array.from({ length: 9 }, (_, i) => `print(${i})`).join('\n')
      expect(() => apply(withPage(), add(helper('b1', nine)), 'bolt')).toThrow(/at most 8/)
      const eight = Array.from({ length: 8 }, (_, i) => `print(${i})\n`).join('\n')
      expect(apply(withPage(), add(helper('b1', eight)), 'bolt').nodes.b1).toBeDefined()
    })

    it('Sparky cannot patch or remove it', () => {
      const s = withHelper()
      expect(() => apply(s, { op: 'update', id: 'b1', patch: { ok: true } }, 'tutor')).toThrow(
        /Bolt's block/
      )
      expect(() => apply(s, { op: 'remove', id: 'b1' }, 'tutor')).toThrow(/cannot remove Bolt/)
    })

    it('the client may store a run but not change the code or request', () => {
      const s = withHelper()
      expect(() => apply(s, { op: 'update', id: 'b1', patch: { source: 'x' } })).toThrow(
        /Bolt's block/
      )
      expect(() => apply(s, { op: 'update', id: 'b1', patch: { request: 'x' } })).toThrow(
        /Bolt's block/
      )
      const ran = apply(s, {
        op: 'update',
        id: 'b1',
        patch: { stdout: 'hi\n', stderr: '', ok: true },
      })
      expect(ran.nodes.b1).toMatchObject({ source: 'print("hi")', stdout: 'hi\n', ok: true })
    })
  })
})
