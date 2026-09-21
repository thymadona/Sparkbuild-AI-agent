import {
  describeStep,
  describeTaskState,
  hasRun,
  outputVerdict,
  taskPrograms,
} from '@/lib/task-evidence'
import { applyClientEvent } from '@/lib/tutor/events'
import { LESSONS } from '@/lib/lessons'
import { stepNode, taskCodeNodeId, taskPageId } from '@/lib/board/tasks'
import type { BoardState } from '@/lib/board/reducer'

const task = LESSONS[0].tasks.find((t) => t.id === 'first-words')!
const page = taskPageId(task)
const code = (id: string, source: string, file?: string) => ({
  id,
  parentId: null,
  createdBy: 'student' as const,
  type: 'code' as const,
  language: 'python' as const,
  source,
  editable: true,
  file,
})
const boardWith = (source: string, ran?: string): BoardState => {
  const id = taskCodeNodeId(task)
  return {
    pages: [{ id: page, title: task.chip, nodeIds: [id, `out_${id}`] }],
    activePageId: page,
    focusId: null,
    nodes: {
      [id]: code(id, source),
      [`out_${id}`]: {
        id: `out_${id}`,
        parentId: null,
        createdBy: 'system',
        type: 'output',
        forNodeId: id,
        stdout: 'hi\n',
        stderr: '',
        ok: true,
        ran,
      },
    },
  } as unknown as BoardState
}

describe('a run that predates an edit', () => {
  it('is stale, and is not proof the code runs', () => {
    const fresh = taskPrograms(boardWith('print("a")', 'print("a")'), task, 'main.py')
    const stale = taskPrograms(boardWith('print("b")', 'print("a")'), task, 'main.py')
    expect(hasRun(fresh)).toBe(true)
    expect(stale[0].stale).toBe(true)
    expect(hasRun(stale)).toBe(false)
  })

  it('counts an output written before `ran` existed as fresh', () => {
    expect(hasRun(taskPrograms(boardWith('print("b")'), task, 'main.py'))).toBe(true)
  })
})

describe('describeTaskState', () => {
  it('tells the tutor about the second program and what is unmet', () => {
    const b = boardWith('print("beep boop")')
    const text = describeTaskState(b, task, taskPrograms(b, task, 'main.py'))
    expect(text).toContain(task.go ?? '')
    expect(text).toContain('second program')
    expect(text).toMatch(/requirement "Sparky says new words": met \(checked against the run\)/)
    expect(text).toMatch(/requirement "Line 2 says new words": NOT met/) // line2.py never ran
  })

  it('keeps the tutor on line2.py once the second program is showing', () => {
    const id = taskCodeNodeId(task)
    const b = boardWith('print("Lolipop")', 'print("Lolipop")')
    b.pages[0].nodeIds.push(`${id}_2`)
    b.nodes[`${id}_2`] = code(`${id}_2`, 'print("Hi Sparky")\nprint("Hell)', 'line2.py') as never
    const text = describeTaskState(b, task, taskPrograms(b, task, 'main.py'))
    expect(text).toContain('first program is finished')
    expect(text).toContain('Talk ONLY about line2.py')
  })

  it('says there is no editor during the concept steps', () => {
    const b = {
      pages: [{ id: page, title: '', nodeIds: [] }],
      activePageId: page,
      focusId: null,
      nodes: {},
    } as BoardState
    expect(describeTaskState(b, task, [])).toContain('no editor yet')
  })
})

describe('code_run event', () => {
  it('names which of two programs ran', () => {
    const id = taskCodeNodeId(task)
    const b = boardWith('print("a")')
    b.pages[0].nodeIds.push(`${id}_2`)
    b.nodes[`${id}_2`] = code(`${id}_2`, 'print("x")', 'line2.py') as never
    const { content } = applyClientEvent(b, {
      type: 'code_run_result',
      nodeId: `${id}_2`,
      source: 'print("x")',
      ok: true,
      stdout: 'x\n',
      stderr: '',
    })
    expect(content).toContain('"file":"line2.py"')
    expect(content).toContain('2 of 2')
  })
})

describe('outputVerdict', () => {
  const prog = (file: string, stdout: string | null, stale = false) => ({
    file,
    source: '',
    stdout,
    error: null,
    stale,
  })
  const check = task.checks!.find((c) => c.kind === 'outputContains' && c.file === 'line2.py')!

  it('is false until the named program has run, and true once its output matches', () => {
    expect(outputVerdict(check, [prog('main.py', 'x\n')], 'main.py')).toBe(false)
    expect(outputVerdict(check, [prog('line2.py', 'Hi\nbye bye\n')], 'main.py')).toBe(false)
    expect(outputVerdict(check, [prog('line2.py', 'Hi\nsee you\n')], 'main.py')).toBe(true)
  })

  it('does not trust output from older code', () => {
    expect(outputVerdict(check, [prog('line2.py', 'Hi\nsee you\n', true)], 'main.py')).toBe(false)
  })
})

describe('describeStep', () => {
  const withSteps = (n: number, patch: Record<string, unknown> = {}) => {
    const nodes: Record<string, unknown> = {}
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const node = { ...stepNode(task, i)!, ...(i === n - 1 ? patch : { answered: true }) } as {
        id: string
      }
      nodes[node.id] = node
      ids.push(node.id)
    }
    return {
      pages: [{ id: page, title: '', nodeIds: ids }],
      activePageId: page,
      focusId: null,
      nodes,
    } as unknown as BoardState
  }
  const quizAt = task.steps!.findIndex((s) => s.kind === 'choose')

  it('names the open step, its options, the pick and the misses', () => {
    const b = withSteps(quizAt + 1, { picked: 0, attempts: 1 })
    const text = describeStep(b, task)!
    expect(text).toContain(`step ${quizAt + 1} of ${task.steps!.length}`)
    expect(text).toContain('(RIGHT)')
    expect(text).toMatch(/misses: 1/)
    expect(describeTaskState(b, task, [])).toContain('no editor yet')
  })

  it('has nothing to say before a step is on the board', () => {
    expect(describeStep(withSteps(0), task)).toBeNull()
  })
})

describe('step feedback events', () => {
  const board = { pages: [], activePageId: null, focusId: null, nodes: {} } as unknown as BoardState

  it('step_answer tells the tutor what was picked and to hold the answer back', () => {
    const { content } = applyClientEvent(board, {
      type: 'step_answer',
      nodeId: 'step_x_1',
      prompt: 'What will Sparky say?',
      picked: '"Hi Ada"',
      attempts: 1,
    })
    expect(content).toContain('type="step_answer"')
    expect(content).toContain('"picked":"\\"Hi Ada\\""')
    expect(content).toMatch(/Do not say the right answer unless attempts is 2/)
  })

  it('stage_result carries the program and needs no board node', () => {
    const { content } = applyClientEvent(board, {
      type: 'stage_result',
      nodeId: 'step_x_0',
      prompt: 'Get the gem',
      program: ['move'],
      attempts: 3,
    })
    expect(content).toContain('"program":["move"]')
    expect(content).toMatch(/did not reach the goal/)
  })
})
