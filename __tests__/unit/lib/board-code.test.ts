import { apply, emptyBoard } from '@/lib/board/reducer'
import {
  blockOf,
  boardCode,
  boardFiles,
  boardFromFiles,
  codeNodeId,
  pageCode,
  withBoardCode,
  SavedBoard,
} from '@/lib/board/code'

const withCode = (b: ReturnType<typeof emptyBoard>, id: string, source: string) => {
  const base = b.pages.length ? b : apply(b, { op: 'new_page', pageId: 'p1', title: 'One' })
  return apply(base, {
    op: 'add',
    pageId: base.activePageId ?? 'p1',
    node: {
      id,
      parentId: null,
      createdBy: 'tutor',
      type: 'code',
      language: 'python',
      source,
      editable: true,
    },
  })
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
    expect(withBoardCode({ 'main.py': 'old', 'bugzap.py': 'x' }, 'main.py', board)).toEqual({
      'main.py': 'print(1)',
      'bugzap.py': 'x',
    })
    const files = { 'main.py': 'old' }
    expect(withBoardCode(files, 'main.py', emptyBoard())).toBe(files)
  })

  it('scopes code to one page, so a later task cannot answer an earlier one', () => {
    // The board is one page per task. boardCode spans the whole board, so on its
    // own it hands an open task the code of a later page — the bug this fixes.
    const first = apply(emptyBoard(), { op: 'new_page', pageId: 't_one', title: 'One' })
    const withFirst = apply(first, {
      op: 'add',
      pageId: 't_one',
      node: {
        id: 'c1',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source: 'print(1)',
        editable: true,
      },
    })
    const second = apply(withFirst, { op: 'new_page', pageId: 't_two', title: 'Two' })
    const board = apply(second, {
      op: 'add',
      pageId: 't_two',
      node: {
        id: 'c2',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source: 'print(2)',
        editable: true,
      },
    })

    expect(boardCode(board)).toBe('print(2)')
    expect(pageCode(board, 't_one')).toBe('print(1)')
    expect(pageCode(board, 't_two')).toBe('print(2)')
    expect(pageCode(board, 'nope')).toBeNull()
  })

  it('writes each node back to its own file, defaulting to the entry', () => {
    const base = apply(emptyBoard(), { op: 'new_page', pageId: 'p1', title: 'One' })
    const main = apply(base, {
      op: 'add',
      pageId: 'p1',
      node: {
        id: 'c1',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source: 'print(1)',
        editable: true,
      },
    })
    const board = apply(main, {
      op: 'add',
      pageId: 'p1',
      node: {
        id: 'c2',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        file: 'bugzap.py',
        source: 'fixed',
        editable: true,
      },
    })

    expect(boardFiles(board, 'main.py')).toEqual({ 'main.py': 'print(1)', 'bugzap.py': 'fixed' })
    expect(withBoardCode({ 'main.py': 'old', 'bugzap.py': 'broken' }, 'main.py', board)).toEqual({
      'main.py': 'print(1)',
      'bugzap.py': 'fixed',
    })
  })

  it('accepts a real board and rejects a bad node', () => {
    expect(SavedBoard.safeParse(boardFromFiles('x')).success).toBe(true)
    const bad = { ...boardFromFiles('x'), nodes: { main: { id: 'main', type: 'nope' } } }
    expect(SavedBoard.safeParse(bad).success).toBe(false)
  })
})

describe('blockOf (the part of the file a task shows)', () => {
  // The shape every shared-file lesson still has (and week-1 boards made before tasks owned their program).
  const file = [
    '# WEEK 1: Wake the Robot',
    '# Sparky is asleep. Press Run and watch: Sparky says every line you print.',
    '',
    '# TASK: first-words',
    '# Change the words inside the quotes.',
    'print("beep boop")',
    '',
    '# TASK: intro-3',
    '# BIG ONE: tell Sparky about you in 3 lines.',
    '',
    '# TASK: name-tag',
    '# Save your name in a variable. Then greet yourself with it.',
    '',
    '',
    '# TASK: hw-add-fact',
    '# HOMEWORK: add 2 more facts about you.',
    '',
  ].join('\n')

  it('shows only the lines under the task comment', () => {
    const b = blockOf(file, 'TASK: first-words')
    expect(b.block).toBe('# Change the words inside the quotes.\nprint("beep boop")\n')
    expect(b.block).not.toContain('TASK')
    expect(b.offset).toBe(4)
  })

  it('puts an edit back without touching the rest of the file', () => {
    const b = blockOf(file, 'TASK: first-words')
    const edited = b.compose(
      '# Change the words inside the quotes.\nprint("hello")\nprint("again")'
    )
    expect(edited.split('\n').slice(0, 3).join('\n')).toBe(file.split('\n').slice(0, 3).join('\n'))
    expect(edited).toContain('# TASK: name-tag')
    expect(edited).toContain('print("again")')
    expect(edited.endsWith(file.slice(file.indexOf('# TASK: name-tag')))).toBe(true)
  })

  it('round-trips, so the editor never sees its own edit as an outside change', () => {
    const b = blockOf(file, 'TASK: name-tag')
    for (const typed of [b.block, `${b.block}\nname = "Ada"\n`, '', 'x']) {
      const full = b.compose(typed)
      expect(blockOf(full, 'TASK: name-tag').block).toBe(typed)
    }
  })

  it('leaves an untouched empty block alone', () => {
    const src = '# TASK: a\n# TASK: b\nprint(1)'
    const b = blockOf(src, 'TASK: a')
    expect(b.block).toBe('')
    expect(b.compose('')).toBe(src)
    expect(b.compose('x')).toBe('# TASK: a\nx\n# TASK: b\nprint(1)')
  })

  it('shows the last task up to the end of the file', () => {
    expect(blockOf(file, 'TASK: hw-add-fact').block).toContain('HOMEWORK')
  })

  it('falls back to the whole file when there is no anchor, or the comment is gone', () => {
    expect(blockOf(file).block).toBe(file)
    expect(blockOf(file, 'TASK: nope').block).toBe(file)
    expect(blockOf(file, 'TASK: nope').compose('x')).toBe('x')
  })

  it("never mistakes a task's second program for the main one", () => {
    let b = apply(emptyBoard(), { op: 'new_page', pageId: 'p1', title: 'One' })
    const node = (id: string, source: string, file?: string) => ({
      id,
      parentId: null,
      createdBy: 'student',
      type: 'code',
      language: 'python',
      source,
      editable: true,
      ...(file ? { file } : {}),
    })
    b = apply(b, { op: 'add', pageId: 'p1', node: node('a', 'print("main")') })
    b = apply(b, { op: 'add', pageId: 'p1', node: node('b', 'print("side")', 'line2.py') })
    expect(pageCode(b, 'p1')).toBe('print("main")')
    expect(boardCode(b)).toBe('print("main")')
    expect(boardFiles(b, 'main.py')).toEqual({
      'main.py': 'print("main")',
      'line2.py': 'print("side")',
    })
  })
})
