import { LESSONS } from '@/lib/lessons'
import {
  cheer,
  stepAction,
  awaitingEditor,
  nextStepIndex,
  stepNode,
  stepNodeId,
  taskCodeNodeId,
  taskFile,
  taskForPageId,
  taskIndexForPageId,
  taskPageId,
  taskStarter,
} from '@/lib/board/tasks'
import { BoardNode, NodeId } from '@/lib/board/schema'
import { emptyBoard, type BoardState } from '@/lib/board/reducer'

const lesson = LESSONS[0]

describe('board task pages', () => {
  it('binds a page to a task by id, both ways', () => {
    for (const task of lesson.tasks) {
      expect(taskForPageId(lesson, taskPageId(task))).toBe(task)
      expect(taskIndexForPageId(lesson, taskPageId(task))).toBe(lesson.tasks.indexOf(task))
    }
  })

  it('leaves loose pages alone', () => {
    // boardFromFiles migrates pre-board work onto a page called p_main, and
    // free-form boards name their own. Neither has a task.
    expect(taskForPageId(lesson, 'p_main')).toBeNull()
    expect(taskForPageId(lesson, 'p1')).toBeNull()
    expect(taskForPageId(null, taskPageId(lesson.tasks[0]))).toBeNull()
    expect(taskIndexForPageId(lesson, 'p_main')).toBe(-1)
  })

  it('makes a legal node id from every task id in the catalog', () => {
    // Task ids contain hyphens; NodeId does not allow them.
    for (const l of LESSONS)
      for (const task of l.tasks) {
        expect(NodeId.safeParse(taskCodeNodeId(task)).success).toBe(true)
      }
    expect(taskCodeNodeId(lesson.tasks.find((t) => t.id === 'name-tag')!)).toBe('code_name_tag')
  })

  it('sends a task to the file its own checks name', () => {
    const bugzap = lesson.tasks.find((t) => t.id === 'hw-bug-quote')!
    expect(taskFile(bugzap, 'main.py')).toBe('bugzap.py')
    expect(taskFile(lesson.tasks[0], 'main.py')).toBe('main.py')
  })
})

describe('concept steps', () => {
  const first = lesson.tasks.find((t) => t.id === 'first-words')!
  const boardWith = (nodes: BoardNode[]): BoardState => ({
    pages: [{ id: taskPageId(first), title: first.chip, nodeIds: nodes.map((n) => n.id) }],
    activePageId: taskPageId(first),
    focusId: null,
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  })
  const answered = (i: number) => ({ ...stepNode(first, i)!, answered: true }) as BoardNode

  it('turns every step into a valid board node with a legal id', () => {
    for (const l of LESSONS)
      for (const task of l.tasks)
        for (let i = 0; i < (task.steps?.length ?? 0); i++) {
          expect(BoardNode.safeParse(stepNode(task, i)).success).toBe(true)
          expect(NodeId.safeParse(stepNodeId(task, i)).success).toBe(true)
        }
  })

  it('has a correct answer inside the options of every choose step', () => {
    for (const l of LESSONS)
      for (const task of l.tasks)
        for (const step of task.steps ?? []) {
          if (step.kind === 'choose') expect(step.options[step.answer]).toBeDefined()
        }
  })

  it('reveals steps one at a time, only after the last one is answered', () => {
    expect(nextStepIndex(boardWith([]), first)).toBe(0)
    expect(nextStepIndex(boardWith([stepNode(first, 0)!]), first)).toBeNull() // step 0 still open
    expect(nextStepIndex(boardWith([answered(0)]), first)).toBe(1)
  })

  it('tells the student what to do once the steps end', () => {
    for (const l of LESSONS)
      for (const task of l.tasks) if (task.steps?.length) expect(task.go).toBeTruthy()
  })

  it('has no editor to judge until the steps are done', () => {
    // The hazard: with no code node on the page, callers fall back to boardCode
    // (a previous task's program) and auto-complete on it.
    const page = taskPageId(first)
    expect(awaitingEditor(boardWith([stepNode(first, 0)!]), first, page)).toBe(true)
    const editor: BoardNode = {
      id: taskCodeNodeId(first),
      parentId: null,
      createdBy: 'student',
      type: 'code',
      language: 'python',
      source: 'print("x")',
      editable: true,
    }
    expect(awaitingEditor(boardWith([editor]), first, page)).toBe(false)
    // A task without steps (or a page saved before steps existed) is never "waiting".
    const plain = lesson.tasks.find((t) => !t.steps?.length)!
    expect(awaitingEditor(boardWith([]), plain, taskPageId(plain))).toBe(false)
  })
})

describe('taskStarter', () => {
  const code = (source: string) => ({
    id: 'c',
    parentId: null,
    createdBy: 'student' as const,
    type: 'code' as const,
    language: 'python' as const,
    source,
    editable: true,
  })
  const boardOf = (pageId: string, source: string) => ({
    pages: [{ id: pageId, title: '', nodeIds: ['c'] }],
    activePageId: pageId,
    focusId: null,
    nodes: { c: code(source) },
  })
  const task = (over: object) =>
    ({ id: 'x', type: 'core', chip: '', success: '', prompt: '', ...over }) as never

  it('is null for a task that works in the shared file', () => {
    expect(taskStarter(emptyBoard(), task({}))).toBeNull()
  })

  it("is the task's own starter", () => {
    expect(taskStarter(emptyBoard(), task({ starter: '# go\n' }))).toBe('# go\n')
  })

  it("starts from the earlier task's final code, then adds its own starter", () => {
    const board = boardOf('t_name-tag', 'name = "Ada"\nprint(f"Hi {name}")\n\n\n')
    expect(taskStarter(board, task({ from: 'name-tag', starter: '# LOUD\n' }))).toBe(
      'name = "Ada"\nprint(f"Hi {name}")\n\n# LOUD\n'
    )
  })

  it('falls back to the starter alone when the earlier page has no code', () => {
    expect(taskStarter(emptyBoard(), task({ from: 'name-tag', starter: '# LOUD\n' }))).toBe(
      '# LOUD\n'
    )
  })
})

describe('stepAction', () => {
  it('tells the student what to press on every kind of step', () => {
    const first = LESSONS[0].tasks.find((t) => t.id === 'first-words')!
    const actions = (first.steps ?? []).map((_, i) => stepAction(stepNode(first, i)!))
    expect(actions.every((a) => a.length > 0)).toBe(true)
    expect(actions[0]).toBe('Tap Next to keep going.')
  })
})

describe('cheer', () => {
  it('never repeats on neighbouring steps', () => {
    for (let i = 0; i < 20; i++) expect(cheer(i)).not.toBe(cheer(i + 1))
  })
})
