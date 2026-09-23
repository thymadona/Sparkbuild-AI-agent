/** @jest-environment jsdom */
import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import QuizNode from '@/app/board/QuizNode'
import SandboxNode from '@/app/board/SandboxNode'
import StageNode from '@/app/board/StageNode'
import { BugNode, LearnNode, MatchNode, OrderNode, WalkNode } from '@/app/board/StepNodes'
import type { CodeActions } from '@/app/board/Nodes'
import type { BoardNode } from '@/lib/board/schema'

type Quiz = Extract<BoardNode, { type: 'quiz' }>
type Sandbox = Extract<BoardNode, { type: 'sandbox' }>

const quiz: Quiz = {
  id: 'q',
  parentId: null,
  createdBy: 'system',
  type: 'quiz',
  kind: 'multiple_choice',
  prompt: 'Which?',
  options: ['no', 'yes', 'nope'],
  answer: 1,
  explain: 'Because yes.',
  picked: null,
  attempts: 0,
  answered: false,
}
const sandbox: Sandbox = {
  id: 's',
  parentId: null,
  createdBy: 'system',
  type: 'sandbox',
  prompt: 'Try',
  template: 'print("{}")',
  chips: ['hello', 'hi'],
  value: '',
  said: '',
  seen: [],
  need: 2,
  answered: false,
}

// The board owns the node; this stands in for its `patch` action.
function Harness<T extends Quiz | Sandbox>({
  start,
  View,
}: {
  start: T
  View: (p: { node: T; code: CodeActions }) => React.ReactNode
}) {
  const [node, setNode] = useState(start)
  const code = {
    patch: (_id: string, patch: Record<string, unknown>) =>
      setNode((n) => ({ ...n, ...patch }) as T),
  } as CodeActions
  return <>{View({ node, code })}</>
}

describe('quiz step', () => {
  const view = () =>
    render(<Harness start={quiz} View={({ node, code }) => <QuizNode node={node} code={code} />} />)

  it('lets a first wrong answer try again without giving the answer away', () => {
    view()
    fireEvent.click(screen.getByText('no'))
    expect(screen.getByRole('status').textContent).toBe('Not quite. Try again.')
    expect(screen.getByText('yes').closest('button')).not.toBeDisabled()
  })

  it('shows the answer after a second miss and waits for Next', () => {
    view()
    fireEvent.click(screen.getByText('no'))
    fireEvent.click(screen.getByText('nope'))
    expect(screen.getByRole('status').textContent).toContain('Because yes.')
    expect(screen.getByText('yes').closest('button')).toBeDisabled()
    fireEvent.click(screen.getByText('Next ▸'))
    expect(screen.queryByText('Next ▸')).toBeNull()
  })

  it('resolves on a right answer', () => {
    view()
    fireEvent.click(screen.getByText('yes'))
    expect(screen.getByRole('status').textContent).toContain('Yes!')
  })

  it('is read-only with no board to write to', () => {
    render(<QuizNode node={quiz} />)
    expect(screen.getByText('yes').closest('button')).toBeDisabled()
  })
})

describe('sandbox step', () => {
  it('needs distinct tries, then says the words', () => {
    render(
      <Harness start={sandbox} View={({ node, code }) => <SandboxNode node={node} code={code} />} />
    )
    expect(screen.getByText('Click 2 different lines.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'print("hello")' }))
    expect(screen.getByText(/Click 2 different lines./)).toBeTruthy() // picking a line does not say it yet
    fireEvent.click(screen.getByText(/Say it/))
    expect(screen.getByText(/Sparky says/).parentElement?.textContent).toContain('hello')
    // After one click, say plainly that another is needed.
    expect(screen.getByText(/Click 1 more line. 1 of 2 done./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tried. print("hello")' })) // the same line twice does not count twice
    fireEvent.click(screen.getByText(/Say it/))
    expect(screen.getByText(/1 of 2 done/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'print("hi")' }))
    fireEvent.click(screen.getByText(/Say it/))
    expect(screen.getByText('Great! You did it.')).toBeTruthy()
  })

  it('says typed words and ignores blanks', () => {
    render(
      <Harness
        start={{ ...sandbox, chips: [], need: 1 }}
        View={({ node, code }) => <SandboxNode node={node} code={code} />}
      />
    )
    expect(screen.getByText(/Say it/).closest('button')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Words for Sparky'), { target: { value: 'wow' } })
    fireEvent.click(screen.getByText(/Say it/))
    expect(screen.getByRole('status').textContent).toContain('wow')
  })
})

const at = <T extends BoardNode['type']>(node: Record<string, unknown> & { type: T }) =>
  ({ id: 'n', parentId: null, createdBy: 'system', answered: false, ...node }) as Extract<
    BoardNode,
    { type: T }
  >
const wrap = <T extends BoardNode>(
  start: T,
  View: (p: { node: T; code: CodeActions }) => React.ReactNode
) => render(<Harness start={start as never} View={View as never} />)

describe('learn step', () => {
  const frames = [
    { code: 'print', note: 'one', hl: 'print' },
    { code: 'print("a")', note: 'two', hl: 'a', speak: 'a' },
  ]
  const view = (f: unknown[] = frames) =>
    wrap(at({ type: 'learn', prompt: 'Meet', frames: f, frame: 0 }), ({ node, code }) => (
      <LearnNode node={node} code={code} />
    ))

  it('walks the frames, then resolves on the last', () => {
    view()
    expect(screen.getByText('one')).toBeTruthy()
    fireEvent.click(screen.getByText('Next ▸'))
    expect(screen.getByText('two')).toBeTruthy()
    fireEvent.click(screen.getByText('Got it ✓'))
    expect(screen.queryByText('Got it ✓')).toBeNull()
  })

  it('has Sparky speak only the words, typing them out, and can replay', () => {
    jest.useFakeTimers()
    try {
      view()
      fireEvent.click(screen.getByText('Next ▸'))
      expect(screen.getByLabelText('Sparky is speaking')).toBeTruthy()
      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(screen.getByLabelText('Sparky is celebrating')).toBeTruthy()
      expect(screen.getByRole('status').textContent).toContain('Sparky says a')
      fireEvent.click(screen.getByText('↻ Again'))
      expect(screen.getByLabelText('Sparky is speaking')).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })

  it('still shows a frame saved with the old `say` field', () => {
    view([{ code: 'print', say: 'old words' }])
    expect(screen.getByText('old words')).toBeTruthy()
  })
})

describe('order step', () => {
  const node = at({
    type: 'order',
    prompt: 'Order',
    lines: ['print("Hi")', 'print("Bye")'],
    arranged: [],
    attempts: 0,
  })
  const view = () => wrap(node, ({ node, code }) => <OrderNode node={node} code={code} />)
  const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
  const play = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms)
    })
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('has Sparky say the lines in order, then finishes', () => {
    view()
    expect(screen.getByText(/Say it/).closest('button')).toBeDisabled()
    tap('print("Hi")')
    tap('print("Bye")')
    fireEvent.click(screen.getByText(/Say it/))
    play(200)
    expect(screen.getByRole('status').textContent).toContain('Sparky says Hi')
    expect(screen.getByText('Say it', { exact: false }).closest('button')).toBeDisabled() // locked while Sparky talks
    play(1500)
    expect(screen.getByRole('status').textContent).toContain('Sparky says Bye')
    play(1500)
    expect(screen.getByText('Sparky said them in order!')).toBeTruthy()
  })

  it('lets a wrong order retry once, then shows the answer and waits for Next', () => {
    view()
    for (let round = 0; round < 2; round++) {
      tap('print("Bye")')
      tap('print("Hi")')
      fireEvent.click(screen.getByText(/Say it/))
      play(3000)
      if (round === 0) expect(screen.getByText('Not quite. Try again.')).toBeTruthy()
    }
    expect(screen.getByText('Here is the order.')).toBeTruthy()
    expect(screen.queryByText('Sparky said them in order!')).toBeNull()
    fireEvent.click(screen.getByText('Next ▸'))
    expect(screen.getByText('Sparky said them in order!')).toBeTruthy()
  })
})

describe('bug step', () => {
  const view = () =>
    wrap(
      at({
        type: 'bug',
        prompt: 'Tap',
        code: 'print("a")\nprint(b)',
        bugLine: 1,
        explain: 'Quotes.',
        picked: null,
        attempts: 0,
      }),
      ({ node, code }) => <BugNode node={node} code={code} />
    )

  it('resolves on the broken line', () => {
    view()
    fireEvent.click(screen.getByText('print(b)'))
    expect(screen.getByRole('status').textContent).toContain('Found it!')
  })

  it('reveals the bug after two misses', () => {
    view()
    fireEvent.click(screen.getByText('print("a")'))
    expect(screen.getByRole('status').textContent).toBe('Not that one. Try again.')
    fireEvent.click(screen.getByText('print("a")'))
    expect(screen.getByRole('status').textContent).toContain('Here it is: Quotes.')
    fireEvent.click(screen.getByText('Next ▸'))
    expect(screen.queryByText('Next ▸')).toBeNull()
  })
})

describe('match step', () => {
  it('locks pairs and resolves when all match, ignoring a wrong pair', () => {
    wrap(
      at({
        type: 'match',
        prompt: 'Match',
        pairs: [
          { left: 'print', right: 'speaks' },
          { left: '"hi"', right: 'the words' },
        ],
        matched: [],
        picked: null,
        attempts: 0,
      }),
      ({ node, code }) => <MatchNode node={node} code={code} />
    )
    fireEvent.click(screen.getByText('print'))
    fireEvent.click(screen.getByText('the words')) // wrong
    expect(screen.getByRole('status').textContent).toBe('Not a match. Try again.')
    fireEvent.click(screen.getByText('print'))
    fireEvent.click(screen.getByText('speaks'))
    fireEvent.click(screen.getByText('"hi"'))
    fireEvent.click(screen.getByText('the words'))
    expect(screen.getByRole('status').textContent).toBe('All matched!')
  })
})

describe('feedback to the tutor', () => {
  const feedback = jest.fn()
  beforeEach(() => feedback.mockClear())
  const tracked = <T extends BoardNode>(
    start: T,
    View: (p: { node: T; code: CodeActions }) => React.ReactNode
  ) =>
    render(
      <Harness
        start={start as never}
        View={({ node, code }) =>
          View({ node: node as T, code: { ...code, feedback } as CodeActions })
        }
      />
    )

  it('quiz: a wrong pick reports the question, what was picked and the miss count', () => {
    tracked(quiz, ({ node, code }) => <QuizNode node={node} code={code} />)
    fireEvent.click(screen.getByText('no'))
    expect(feedback).toHaveBeenCalledWith({
      type: 'step_answer',
      nodeId: 'q',
      prompt: 'Which?',
      picked: 'no',
      attempts: 1,
    })
  })

  it('quiz: a right pick says nothing to the tutor', () => {
    tracked(quiz, ({ node, code }) => <QuizNode node={node} code={code} />)
    fireEvent.click(screen.getByText('yes'))
    expect(feedback).not.toHaveBeenCalled()
  })

  it('bug and match: a wrong pick is reported in words', () => {
    tracked(
      at({
        type: 'bug',
        prompt: 'Tap',
        code: 'print("a")\nprint(b)',
        bugLine: 1,
        explain: 'Quotes.',
        picked: null,
        attempts: 0,
      }),
      ({ node, code }) => <BugNode node={node} code={code} />
    )
    fireEvent.click(screen.getByText('print("a")'))
    expect(feedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'step_answer', picked: 'print("a")', attempts: 1 })
    )
    tracked(
      at({
        type: 'match',
        prompt: 'Match',
        pairs: [
          { left: 'print', right: 'speaks' },
          { left: '"hi"', right: 'the words' },
        ],
        matched: [],
        picked: null,
        attempts: 0,
      }),
      ({ node, code }) => <MatchNode node={node} code={code} />
    )
    fireEvent.click(screen.getAllByText('print')[0])
    fireEvent.click(screen.getAllByText('the words')[0])
    expect(feedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ picked: 'print = the words' })
    )
  })
})

describe('stage step', () => {
  const stage = at({
    type: 'stage',
    prompt: 'Get the gem',
    scene: 'grid',
    config: { w: 3, h: 1, start: { x: 0, y: 0, dir: 'E' }, gems: [[2, 0]] },
    goal: {},
    palette: [
      { label: 'move', ops: ['move'] },
      { label: 'turn left', ops: ['left'] },
    ],
    solution: [0, 0],
    program: [],
    attempts: 0,
  })
  const feedback = jest.fn()
  const view = () =>
    render(
      <Harness
        start={stage as never}
        View={({ node, code }) => (
          <StageNode node={node as typeof stage} code={{ ...code, feedback } as CodeActions} />
        )}
      />
    )
  // Each frame's timer is set by an effect, so advance in separate acts, one frame at a time.
  const play = (ms: number) => {
    for (let t = 0; t < ms; t += 600)
      act(() => {
        jest.advanceTimersByTime(600)
      })
  }
  const build = (...labels: string[]) =>
    labels.forEach((l) =>
      fireEvent.click(within(screen.getByRole('group', { name: 'Blocks' })).getByText(l))
    )
  beforeEach(() => {
    jest.useFakeTimers()
    feedback.mockClear()
  })
  afterEach(() => jest.useRealTimers())

  it('runs the program and resolves when the goal is met', () => {
    view()
    expect(screen.getByText(/Run/).closest('button')).toBeDisabled()
    build('move', 'move')
    expect(
      within(screen.getByRole('list', { name: 'Your program' })).getAllByRole('button')
    ).toHaveLength(2)
    fireEvent.click(screen.getByText(/Run/))
    play(5000)
    expect(screen.getByText('You did it!')).toBeTruthy()
    expect(feedback).not.toHaveBeenCalled()
  })

  it('lets a block come back out of the list', () => {
    view()
    build('move', 'turn left')
    fireEvent.click(screen.getByRole('button', { name: 'Remove turn left' }))
    expect(
      within(screen.getByRole('list', { name: 'Your program' })).getAllByRole('button')
    ).toHaveLength(1)
  })

  it('tells the tutor about a miss, and after three shows a working program', () => {
    view()
    for (let round = 1; round <= 3; round++) {
      if (round === 1) build('move')
      fireEvent.click(screen.getByText(/Run/))
      play(5000)
      expect(feedback).toHaveBeenLastCalledWith({
        type: 'stage_result',
        nodeId: 'n',
        prompt: 'Get the gem',
        program: ['move'],
        attempts: round,
      })
      if (round < 3) expect(screen.getByText(/Not yet/)).toBeTruthy()
    }
    expect(screen.getByText('Here is one way to do it.')).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Your program' })).getAllByRole('button')
    ).toHaveLength(2)
  })
})

describe('walk step', () => {
  const frames = [
    { line: 1, vars: {}, note: 'start' },
    { line: 2, vars: { i: '0' }, note: 'i is 0' },
  ]
  it('steps to the last frame, then resolves', () => {
    wrap(
      at({ type: 'walk', prompt: 'Walk', code: 'a\nb', frames, cursor: 0 }),
      ({ node, code }) => <WalkNode node={node} code={code} />
    )
    expect(screen.getByText('start')).toBeTruthy()
    expect(screen.queryByText(/walked through/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Next step'))
    expect(screen.getByText('i is 0')).toBeTruthy()
    expect(screen.getByText(/walked through/)).toBeTruthy()
  })
})
