/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Navigator from '@/components/Navigator'
import { useLessonProgress } from '@/hooks/useLessonProgress'
import type { Lesson } from '@/lib/lessons'
import type { SubmissionStatus } from '@/types'
import type { ClassSlot } from '@/lib/schedule'

// Every task carries a check keyed to a marker string, so tests can control
// whether a task is "solved" by including or omitting the marker from the
// code passed in — this mirrors the checked shape every real lesson task
// has. The check only gates the Mark done button; the student still clicks
// it themselves.
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
  onHighlight: (lines: number[]) => void
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

  it('renders Mark done disabled until the check passes', () => {
    renderNavigator(['intro'])

    expect(screen.getByRole('button', { name: /not yet/i })).toBeDisabled()
  })

  it('does nothing when Mark done is clicked while the check is unmet', () => {
    renderNavigator(['intro'])

    fireEvent.click(screen.getByRole('button', { name: /not yet/i }))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('saves progress only once the student clicks Mark done', async () => {
    renderNavigator(['intro'], `${NOTHING_SOLVED}\nCOLORS_DONE`)

    fireEvent.click(await screen.findByRole('button', { name: /mark done/i }))

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

  it('completes a bonus task the same way as core tasks', async () => {
    // With core done, the next unfinished task by default is 'choice', not
    // 'bonus' — select the bonus task explicitly before its check can pass.
    renderNavigator(['intro', 'colors', 'theme'], `${NOTHING_SOLVED}\nBONUS_DONE`)
    fireEvent.click(screen.getByRole('button', { name: /Bonus: surprise/i }))
    fireEvent.click(await screen.findByRole('button', { name: /mark done/i }))

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
  it('keeps Mark done disabled while the code is unchanged', () => {
    renderChecked(STARTER)

    expect(screen.getByRole('button', { name: /not yet/i })).toBeDisabled()
  })

  it('does not save progress while the code is unchanged', () => {
    renderChecked(STARTER)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('enables Mark done once the check passes, and saves on click', async () => {
    renderChecked(EDITED)

    const button = await screen.findByRole('button', { name: /mark done/i })
    expect(button).toBeEnabled()
    fireEvent.click(button)

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

    expect(onHighlight).toHaveBeenCalledWith([2])
  })

  it('reports no line when the anchor comment is gone', () => {
    const onHighlight = jest.fn()
    render(<Harness code={'nothing to find here'} completedTaskIds={[]} onHighlight={onHighlight} onPrompt={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Write your intro/ }))

    expect(onHighlight).toHaveBeenCalledWith([])
  })

  it('drops the 10px letterspaced caps and enlarges task text', () => {
    const { container } = render(<Harness code={NOTHING_SOLVED} completedTaskIds={[]} onHighlight={jest.fn()} onPrompt={jest.fn()} />)

    expect(container.querySelectorAll('.text-\\[10px\\]')).toHaveLength(0)
    expect(container.querySelectorAll('.uppercase')).toHaveLength(0)
    expect(screen.getAllByText('Core mission')[0].className).toContain('text-xs')
  })
})

// Homework used to be its own side panel (components/Homework.tsx). It's now
// folded into the same scrollable Tasks list Navigator renders, sharing the
// one activeIndex/activeTask useLessonProgress already tracks across every
// task type — this fixture and harness reproduce that panel's coverage
// through Navigator directly.
const homeworkLesson: Lesson = {
  id: 1,
  title: 'Week #1 — Profile Pop',
  homeworkBrief: 'Add one new thing to your page.',
  description: 'Test lesson',
  templateFile: 'personal-page.html',
  tasks: [
    { id: 'intro', type: 'core', chip: 'Write your intro', success: 'Done', prompt: 'intro', commentAnchor: 'intro anchor' },
    { id: 'colors', type: 'core', chip: 'Choose colors', success: 'Done', prompt: 'colors', commentAnchor: 'colors anchor' },
    { id: 'theme', type: 'core', chip: 'Choose a theme', success: 'Done', prompt: 'theme', commentAnchor: 'theme anchor' },
    // Checks keyed to markers absent from the default test code, so a
    // homework task landing on it as the default active task (once core is
    // done) starts with Mark done disabled, before a test can observe it.
    { id: 'hw-one', type: 'homework', chip: 'Homework: add a chip', success: 'Your page has four chips.', prompt: 'hw one', commentAnchor: 'intro anchor', checks: [{ kind: 'sourceMatches', pattern: 'HW_ONE_DONE', label: 'Chip added', hint: 'Add a chip.' }] },
    { id: 'hw-two', type: 'homework', chip: 'Homework: add a picture', success: 'Your page shows a picture.', prompt: 'hw two', commentAnchor: 'intro anchor', checks: [{ kind: 'sourceMatches', pattern: 'HW_TWO_DONE', label: 'Picture added', hint: 'Add a picture.' }] },
  ],
}

const CORE_DONE = ['intro', 'colors', 'theme']

function HomeworkHarness({ completedTaskIds, code = 'intro anchor', submission = null, classSlots }: {
  completedTaskIds: string[]
  code?: string
  submission?: SubmissionStatus | null
  classSlots?: ClassSlot[]
}) {
  const progress = useLessonProgress({
    lesson: homeworkLesson,
    projectId: 'project-1',
    code,
    initialCompletedTaskIds: completedTaskIds,
    initialSubmissionStatus: submission,
    onHighlight: jest.fn(),
    onPrompt: jest.fn(),
  })
  return <Navigator lesson={homeworkLesson} code={code} progress={progress} classSlots={classSlots} />
}

function renderHomework(completedTaskIds: string[], submission: SubmissionStatus | null = null, classSlots?: ClassSlot[]) {
  render(<HomeworkHarness completedTaskIds={completedTaskIds} submission={submission} classSlots={classSlots} />)
}

// Homework is now a collapsed chip ("Homework · X/Y", locked until core is
// done) that expands into an overlay scoped to the Tasks card, rather than
// an always-expanded card — opening it is a separate step from unlocking it.
function homeworkChip() {
  return screen.getByRole('button', { name: /^Homework/ })
}

function openHomework() {
  fireEvent.click(homeworkChip())
}

describe('Navigator homework section', () => {
  it('keeps the homework chip locked until the core mission is done', () => {
    renderHomework([])

    const chip = homeworkChip()
    expect(within(chip).getByText('Locked')).toBeInTheDocument()
    expect(chip).toBeDisabled()

    fireEvent.click(chip)
    expect(screen.queryByText('Add one new thing to your page.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hand in my homework/i })).not.toBeInTheDocument()
  })

  it('shows the homework count on the chip even while locked', () => {
    renderHomework([], null)

    expect(within(homeworkChip()).getByText('0/2')).toBeInTheDocument()
  })

  it('opens homework once the core mission is done', () => {
    renderHomework(CORE_DONE)
    openHomework()

    expect(screen.getByText('Add one new thing to your page.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add a chip/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish homework to hand in' })).toBeDisabled()
  })

  it('blocks handing in until every homework task is done', () => {
    renderHomework([...CORE_DONE, 'hw-one'])
    openHomework()

    expect(within(homeworkChip()).getByText('1/2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish homework to hand in' })).toBeDisabled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('renders Mark done disabled for a homework task until the check passes', () => {
    // Mark done lives in the pinned ActiveTaskPanel footer, not inside the
    // homework overlay, so it's reachable without opening homework — the
    // active task auto-lands on 'hw-one' once core is done.
    renderHomework(CORE_DONE)

    expect(screen.getByRole('button', { name: /not yet/i })).toBeDisabled()
  })

  it('completes a homework task once the student clicks Mark done', async () => {
    render(<HomeworkHarness completedTaskIds={CORE_DONE} code="intro anchor\nHW_ONE_DONE" />)

    fireEvent.click(await screen.findByRole('button', { name: /mark done/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/lesson-progress',
      expect.objectContaining({ method: 'PUT' }),
    ))
    expect(within(homeworkChip()).getByText('1/2')).toBeInTheDocument()
  })

  it('hands homework in when every task is done', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ submissionStatus: 'submitted' }) })
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'])
    openHomework()

    fireEvent.click(screen.getByRole('button', { name: 'Hand in my homework' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/submit',
      expect.objectContaining({ method: 'POST' }),
    ))
    expect(await screen.findByText('Handed in. Your teacher will look soon.')).toBeInTheDocument()
  })

  it('shows the teacher verdict instead of the hand-in button', () => {
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'], 'approved')
    openHomework()

    expect(screen.getByText('🎉 Your teacher said yes!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hand in/i })).not.toBeInTheDocument()
  })

  it('lets a student hand in again after being sent back', () => {
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'], 'needs_work')
    openHomework()

    expect(screen.getByText(/Your teacher asked for one more change/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hand in my homework' })).toBeEnabled()
  })

  it('surfaces a server refusal', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Finish your homework tasks first' }) })
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'])
    openHomework()

    fireEvent.click(screen.getByRole('button', { name: 'Hand in my homework' }))

    expect(await screen.findByText('Finish your homework tasks first')).toBeInTheDocument()
  })

  it('shows the deadline derived from the class schedule', () => {
    renderHomework(CORE_DONE, null, [{ day_of_week: (new Date().getDay() + 2) % 7, start_time: '16:00:00' }])
    openHomework()

    expect(screen.getByText(/^Hand in before /)).toBeInTheDocument()
  })

  it('says nothing about a deadline when the student has no class', () => {
    renderHomework(CORE_DONE)
    openHomework()

    expect(screen.queryByText(/^Hand in (before|today|by)/)).not.toBeInTheDocument()
  })

  it('drops the deadline once the homework is handed in', () => {
    renderHomework(
      [...CORE_DONE, 'hw-one', 'hw-two'],
      'submitted',
      [{ day_of_week: (new Date().getDay() + 2) % 7, start_time: '16:00:00' }],
    )
    openHomework()

    expect(screen.queryByText(/^Hand in before /)).not.toBeInTheDocument()
    expect(screen.getByText('Handed in. Your teacher will look soon.')).toBeInTheDocument()
  })

  it('does not let a student activate a homework task before core is done', () => {
    renderHomework([])

    expect(homeworkChip()).toBeDisabled()
    expect(screen.queryByRole('button', { name: /add a chip/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add a picture/i })).not.toBeInTheDocument()
  })
})
