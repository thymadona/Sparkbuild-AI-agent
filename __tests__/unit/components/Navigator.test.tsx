/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Navigator from '@/components/Navigator'
import { useLessonProgress } from '@/hooks/useLessonProgress'
import type { Lesson } from '@/lib/lessons'

// Every task carries a check keyed to a marker string, so tests can control
// whether a task is "solved" by including or omitting the marker from the
// code passed in — this mirrors the checked shape every real lesson task has
// (self-reporting was retired along with the mark-done button).
const lesson: Lesson = {
  id: 1,
  title: 'Week #1 — Profile Pop',
  description: 'Test lesson',
  templateFile: 'personal-page.html',
  tasks: [
    { id: 'intro', type: 'core', chip: 'Write your intro', success: 'Done', prompt: 'intro', commentAnchor: 'intro anchor', checks: [{ kind: 'sourceMatches', pattern: 'INTRO_DONE', label: 'Intro written', hint: 'Write your intro.' }] },
    { id: 'colors', type: 'core', chip: 'Choose colors', success: 'Done', prompt: 'colors', commentAnchor: 'colors anchor', checks: [{ kind: 'sourceMatches', pattern: 'COLORS_DONE', label: 'Colors chosen', hint: 'Pick colors.' }] },
    { id: 'theme', type: 'core', chip: 'Choose a theme', success: 'Done', prompt: 'theme', commentAnchor: 'theme anchor', checks: [{ kind: 'sourceMatches', pattern: 'THEME_DONE', label: 'Theme chosen', hint: 'Pick a theme.' }] },
    { id: 'choice', type: 'choice', chip: 'Make it yours', success: 'Done', prompt: 'choice', commentAnchor: 'choice anchor', checks: [{ kind: 'sourceMatches', pattern: 'CHOICE_DONE', label: 'Made it yours', hint: 'Customize it.' }] },
    { id: 'bonus', type: 'bonus', chip: 'Bonus: surprise', success: 'Done', prompt: 'bonus', commentAnchor: 'bonus anchor', checks: [{ kind: 'sourceMatches', pattern: 'BONUS_DONE', label: 'Bonus done', hint: 'Add a bonus.' }] },
  ],
}

const NOTHING_SOLVED = 'intro anchor\ncolors anchor\ntheme anchor\nchoice anchor\nbonus anchor'

// Navigator is a thin presentational shell over useLessonProgress, which the
// real app (EditorLayout) calls once and shares between the Tasks and
// Homework panels. Mounting through this harness exercises the same wiring.
function Harness({ testLesson = lesson, code, completedTaskIds, onHighlight, onPrompt }: {
  testLesson?: Lesson
  code: string
  completedTaskIds: string[]
  onHighlight: (line: number | null) => void
  onPrompt: (prompt: string) => void
}) {
  const progress = useLessonProgress({
    lesson: testLesson,
    projectId: 'project-1',
    code,
    initialCompletedTaskIds: completedTaskIds,
    onHighlight,
    onPrompt,
  })
  return <Navigator lesson={testLesson} code={code} progress={progress} />
}

function renderNavigator(completedTaskIds: string[] = [], code: string = NOTHING_SOLVED) {
  const onHighlight = jest.fn()
  const onPrompt = jest.fn()
  render(<Harness code={code} completedTaskIds={completedTaskIds} onHighlight={onHighlight} onPrompt={onPrompt} />)
  return { onHighlight, onPrompt }
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn() })
})

describe('Navigator', () => {
  it('labels core, creative-choice, and bonus tasks and restores core progress', () => {
    renderNavigator(['intro'])

    expect(screen.getByText('1/3 core')).toBeInTheDocument()
    expect(screen.getAllByText('Core mission')).toHaveLength(3)
    expect(screen.getAllByText('Make it yours')).toHaveLength(2)
    expect(screen.getByText('Bonus challenge')).toBeInTheDocument()
  })

  it('lists every task, not just the active one', () => {
    renderNavigator(['intro'])

    expect(screen.getByRole('button', { name: /Write your intro/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose colors/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose a theme/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bonus: surprise/ })).toBeInTheDocument()
  })

  it('grays out tasks that are neither active nor complete', () => {
    renderNavigator(['intro'])

    // 'colors' is active (first unfinished core task); 'theme' is neither
    // done nor active, so it gets the muted/gray treatment.
    const upcoming = screen.getByRole('button', { name: /Choose a theme/ })
    expect(upcoming.className).toContain('text-fg-muted')
    expect(upcoming.className).toContain('bg-surface-700/60')
    expect(upcoming.className).not.toContain('ring-brand-400')
  })

  it('never renders a manual mark-done button', () => {
    renderNavigator(['intro'])

    expect(screen.queryByRole('button', { name: /mark done/i })).not.toBeInTheDocument()
  })

  it('auto-completes the active task once the code satisfies its check', async () => {
    renderNavigator(['intro'], `${NOTHING_SOLVED}\nCOLORS_DONE`)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/lesson-progress',
      expect.objectContaining({ method: 'PUT' }),
    ))
    expect(await screen.findByText('2/3 core')).toBeInTheDocument()
  })

  it('does not save progress while the code does not satisfy the check', () => {
    renderNavigator(['intro'])

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('celebrates completed core tasks while keeping bonuses optional', () => {
    renderNavigator(['intro', 'colors', 'theme'])

    expect(screen.getByText('🎉 Core mission complete!')).toBeInTheDocument()
    expect(screen.getByText('Bonus challenges: 0/1')).toBeInTheDocument()
  })

  it('auto-completes a bonus task the same way as core tasks', async () => {
    // With core done, the next unfinished task by default is 'choice', not
    // 'bonus' — select the bonus task explicitly before its check can fire.
    renderNavigator(['intro', 'colors', 'theme'], `${NOTHING_SOLVED}\nBONUS_DONE`)
    fireEvent.click(screen.getByRole('button', { name: /Bonus: surprise/i }))

    await waitFor(() => expect(screen.getByText('Bonus challenges: 1/1')).toBeInTheDocument())
    expect(screen.getByText('🎉 Core mission complete!')).toBeInTheDocument()
  })

  it('does not show a tutor shortcut section', () => {
    renderNavigator(['intro'])

    expect(screen.queryByText('Ask your AI tutor')).not.toBeInTheDocument()
  })
})

const checkedLesson: Lesson = {
  id: 3,
  title: 'Week #3 — Streak Spark',
  description: 'Test lesson',
  templateFile: 'score-page.html',
  tasks: [
    {
      id: 'goal',
      type: 'core',
      chip: 'Choose a goal',
      success: 'Your tracker has a goal that matters to you.',
      prompt: 'goal',
      commentAnchor: 'TASK: goal name',
      checks: [
        { kind: 'textChanged', selector: 'h1', from: 'My reading streak.', label: 'The big title names your goal', hint: 'Change the <h1> to your own goal.' },
      ],
    },
  ],
}

const STARTER = '<!doctype html><html><body><!-- TASK: goal name --><h1>My reading streak.</h1></body></html>'
const EDITED = '<!doctype html><html><body><!-- TASK: goal name --><h1>My piano streak.</h1></body></html>'

function renderChecked(code: string) {
  const onPrompt = jest.fn()
  render(<Harness testLesson={checkedLesson} code={code} completedTaskIds={[]} onHighlight={jest.fn()} onPrompt={onPrompt} />)
  return { onPrompt }
}

describe('Navigator task checks', () => {
  it('shows a waiting message while the code is unchanged', () => {
    renderChecked(STARTER)

    expect(screen.getByText(/marks itself done once your code matches/)).toBeInTheDocument()
  })

  it('does not save progress while the code is unchanged', () => {
    renderChecked(STARTER)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('auto-completes once the code satisfies the check', async () => {
    renderChecked(EDITED)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/lesson-progress',
      expect.objectContaining({ method: 'PUT' }),
    ))
  })
})

describe('Navigator task list', () => {
  it('lists every task', () => {
    renderNavigator([], NOTHING_SOLVED)

    expect(screen.getByRole('button', { name: /Write your intro/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose colors/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bonus: surprise/ })).toBeInTheDocument()
  })

  it('highlights the anchor line when a task is selected', () => {
    const onHighlight = jest.fn()
    const onPrompt = jest.fn()
    render(<Harness code={'line one\nintro anchor\nline three'} completedTaskIds={[]} onHighlight={onHighlight} onPrompt={onPrompt} />)

    fireEvent.click(screen.getByRole('button', { name: /Write your intro/ }))

    expect(onHighlight).toHaveBeenCalledWith(2)
  })

  it('reports no line when the anchor comment is gone', () => {
    const onHighlight = jest.fn()
    render(<Harness code={'nothing to find here'} completedTaskIds={[]} onHighlight={onHighlight} onPrompt={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Write your intro/ }))

    expect(onHighlight).toHaveBeenCalledWith(null)
  })

  it('drops the 10px letterspaced caps and enlarges task text', () => {
    const { container } = render(<Harness code={NOTHING_SOLVED} completedTaskIds={[]} onHighlight={jest.fn()} onPrompt={jest.fn()} />)

    expect(container.querySelectorAll('.text-\\[10px\\]')).toHaveLength(0)
    expect(container.querySelectorAll('.uppercase')).toHaveLength(0)
    expect(screen.getAllByText('Core mission')[0].className).toContain('text-xs')
    expect(screen.getByRole('button', { name: /Write your intro/ }).className).toContain('text-lg')
  })
})
