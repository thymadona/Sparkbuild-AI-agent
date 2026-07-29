/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Navigator from '@/components/Navigator'
import type { Lesson } from '@/lib/lessons'
import type { SubmissionStatus } from '@/types'

const lesson: Lesson = {
  id: 1,
  title: 'Week #1 — Profile Pop',
  description: 'Test lesson',
  templateFile: 'personal-page.html',
  tasks: [
    { id: 'intro', type: 'core', chip: 'Write your intro', success: 'Done', prompt: 'intro', commentAnchor: 'intro anchor' },
    { id: 'colors', type: 'core', chip: 'Choose colors', success: 'Done', prompt: 'colors', commentAnchor: 'colors anchor' },
    { id: 'theme', type: 'core', chip: 'Choose a theme', success: 'Done', prompt: 'theme', commentAnchor: 'theme anchor' },
    { id: 'choice', type: 'choice', chip: 'Make it yours', success: 'Done', prompt: 'choice', commentAnchor: 'choice anchor' },
    { id: 'bonus', type: 'bonus', chip: 'Bonus: surprise', success: 'Done', prompt: 'bonus', commentAnchor: 'bonus anchor' },
  ],
}

function renderNavigator(completedTaskIds: string[] = []) {
  const onHighlight = jest.fn()
  const onPrompt = jest.fn()
  render(<Navigator lesson={lesson} projectId="project-1" code="intro anchor\ncolors anchor\ntheme anchor\nchoice anchor\nbonus anchor" initialCompletedTaskIds={completedTaskIds} onHighlight={onHighlight} onPrompt={onPrompt} />)
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

  it('saves a completed task and advances to the next unfinished core task', async () => {
    renderNavigator(['intro'])
    fireEvent.click(screen.getByRole('button', { name: 'Mark done ✓' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/lesson-progress',
      expect.objectContaining({ method: 'PUT' }),
    ))
    expect(screen.getByText('2/3 core')).toBeInTheDocument()
    expect(screen.getByText('Finished', { exact: false })).toHaveTextContent('Choose a theme')
  })

  it('celebrates completed core tasks while keeping bonuses optional', async () => {
    renderNavigator(['intro', 'colors', 'theme'])

    expect(screen.getByText('🎉 Core mission complete!')).toBeInTheDocument()
    expect(screen.getByText('Bonus challenges: 0/1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bonus: surprise/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark done ✓' }))

    await waitFor(() => expect(screen.getByText('Bonus challenges: 1/1')).toBeInTheDocument())
    expect(screen.getByText('🎉 Core mission complete!')).toBeInTheDocument()
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
  render(<Navigator lesson={checkedLesson} projectId="project-1" code={code} initialCompletedTaskIds={[]} onHighlight={jest.fn()} onPrompt={jest.fn()} />)
}

describe('Navigator task checks', () => {
  it('blocks completion and shows the hint while the code is unchanged', () => {
    renderChecked(STARTER)

    expect(screen.getByText('Checked in your code: 0/1')).toBeInTheDocument()
    expect(screen.getByText('Change the <h1> to your own goal.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not yet — keep going' })).toBeDisabled()
  })

  it('does not save progress when the student clicks a blocked button', () => {
    renderChecked(STARTER)
    fireEvent.click(screen.getByRole('button', { name: 'Not yet — keep going' }))

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('unlocks completion once the code satisfies the check', async () => {
    renderChecked(EDITED)

    expect(screen.getByText('Checked in your code: 1/1')).toBeInTheDocument()
    expect(screen.getByText('Your code does it. Nice.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mark done ✓' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/lesson-progress',
      expect.objectContaining({ method: 'PUT' }),
    ))
  })

  it('asks the tutor for a hint rather than the answer', () => {
    const onPrompt = jest.fn()
    render(<Navigator lesson={checkedLesson} projectId="project-1" code={STARTER} initialCompletedTaskIds={[]} onHighlight={jest.fn()} onPrompt={onPrompt} />)

    fireEvent.click(screen.getByRole('button', { name: /Ask for a hint/i }))
    expect(onPrompt).toHaveBeenCalledWith(expect.stringContaining('do not write the code for me'))
  })

  it('does not unlock on waiting alone', () => {
    jest.useFakeTimers()
    try {
      renderChecked(STARTER)
      act(() => { jest.advanceTimersByTime(600_000) })

      expect(screen.getByRole('button', { name: 'Not yet — keep going' })).toBeDisabled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('does not unlock on a hint request alone', () => {
    renderChecked(STARTER)
    fireEvent.click(screen.getByRole('button', { name: /Ask for a hint/i }))

    expect(screen.getByRole('button', { name: 'Not yet — keep going' })).toBeDisabled()
  })

  it('unlocks the escape hatch only after both time on task and a hint request', () => {
    jest.useFakeTimers()
    try {
      renderChecked(STARTER)
      fireEvent.click(screen.getByRole('button', { name: /Ask for a hint/i }))
      expect(screen.getByRole('button', { name: 'Not yet — keep going' })).toBeDisabled()

      act(() => { jest.advanceTimersByTime(90_000) })

      expect(screen.getByRole('button', { name: 'Stuck? Mark done anyway' })).toBeEnabled()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('Navigator kid mode', () => {
  function renderKidMode(completedTaskIds: string[] = [], kidMode = true) {
    render(<Navigator lesson={lesson} projectId="project-1" code="intro anchor" initialCompletedTaskIds={completedTaskIds} onHighlight={jest.fn()} onPrompt={jest.fn()} kidMode={kidMode} />)
  }

  it('shows only the current task and counts the rest', () => {
    renderKidMode()

    expect(screen.getByRole('button', { name: /Write your intro/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Choose colors/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bonus: surprise/ })).not.toBeInTheDocument()
    expect(screen.getByText('4 more after this one.')).toBeInTheDocument()
  })

  it('keeps finished tasks visible alongside the current one', () => {
    renderKidMode(['intro'])

    expect(screen.getByRole('button', { name: /Write your intro/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose colors/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Choose a theme/ })).not.toBeInTheDocument()
    expect(screen.getByText('3 more after this one.')).toBeInTheDocument()
  })

  it('points at the anchor line again without talking to the tutor', () => {
    const onHighlight = jest.fn()
    const onPrompt = jest.fn()
    render(<Navigator lesson={lesson} projectId="project-1" code={'line one\nintro anchor\nline three'} initialCompletedTaskIds={[]} onHighlight={onHighlight} onPrompt={onPrompt} />)

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))

    expect(onHighlight).toHaveBeenCalledWith(2)
    expect(onPrompt).not.toHaveBeenCalled()
  })

  it('lists every task when kid mode is off', () => {
    renderKidMode([], false)

    expect(screen.getByRole('button', { name: /Choose colors/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bonus: surprise/ })).toBeInTheDocument()
    expect(screen.queryByText(/more after this one/)).not.toBeInTheDocument()
  })

  it('reports no line when the anchor comment is gone', () => {
    const onHighlight = jest.fn()
    render(<Navigator lesson={lesson} projectId="project-1" code={'nothing to find here'} initialCompletedTaskIds={[]} onHighlight={onHighlight} onPrompt={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))

    expect(onHighlight).toHaveBeenCalledWith(null)
  })

  it('drops the 10px letterspaced caps and enlarges task text', () => {
    const { container } = render(<Navigator lesson={lesson} projectId="project-1" code="intro anchor" initialCompletedTaskIds={[]} onHighlight={jest.fn()} onPrompt={jest.fn()} kidMode />)

    expect(container.querySelectorAll('.text-\\[10px\\]')).toHaveLength(0)
    expect(container.querySelectorAll('.uppercase')).toHaveLength(0)
    expect(screen.getByText('Core mission').className).toContain('text-xs')
    expect(screen.getByRole('button', { name: /Write your intro/ }).className).toContain('text-lg')
  })

  it('still uses the compact scale when kid mode is off', () => {
    const { container } = render(<Navigator lesson={lesson} projectId="project-1" code="intro anchor" initialCompletedTaskIds={[]} onHighlight={jest.fn()} onPrompt={jest.fn()} />)

    expect(container.querySelectorAll('.text-\\[10px\\]').length).toBeGreaterThan(0)
  })
})

const homeworkLesson: Lesson = {
  ...lesson,
  homeworkBrief: 'Add one new thing to your page.',
  tasks: [
    ...lesson.tasks,
    { id: 'hw-one', type: 'homework', chip: 'Homework: add a chip', success: 'Your page has four chips.', prompt: 'hw one', commentAnchor: 'intro anchor' },
    { id: 'hw-two', type: 'homework', chip: 'Homework: add a picture', success: 'Your page shows a picture.', prompt: 'hw two', commentAnchor: 'intro anchor' },
  ],
}

const CORE_DONE = ['intro', 'colors', 'theme']

function renderHomework(completedTaskIds: string[], submission: SubmissionStatus | null = null) {
  render(
    <Navigator
      lesson={homeworkLesson}
      projectId="project-1"
      code="intro anchor"
      initialCompletedTaskIds={completedTaskIds}
      onHighlight={jest.fn()}
      onPrompt={jest.fn()}
      initialSubmissionStatus={submission}
    />,
  )
}

describe('Navigator homework', () => {
  it('keeps homework closed until the core mission is done', () => {
    renderHomework([])

    expect(screen.getByText('Finish your mission first. Then homework opens.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hand in my homework/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Add one new thing to your page.')).not.toBeInTheDocument()
  })

  it('does not count homework in the "more after this" tally', () => {
    renderHomework([], null)

    // 4 remaining non-homework tasks, not 6.
    expect(screen.getByText('Homework · 0/2')).toBeInTheDocument()
  })

  it('opens homework once the core mission is done', () => {
    renderHomework(CORE_DONE)

    expect(screen.getByText('Add one new thing to your page.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add a chip/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish homework to hand in' })).toBeDisabled()
  })

  it('blocks handing in until every homework task is done', () => {
    renderHomework([...CORE_DONE, 'hw-one'])

    expect(screen.getByText('Homework · 1/2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish homework to hand in' })).toBeDisabled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('hands homework in when every task is done', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ submissionStatus: 'submitted' }) })
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'])

    fireEvent.click(screen.getByRole('button', { name: 'Hand in my homework' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/submit',
      expect.objectContaining({ method: 'POST' }),
    ))
    expect(await screen.findByText('Handed in. Your teacher will look soon.')).toBeInTheDocument()
  })

  it('shows the teacher verdict instead of the hand-in button', () => {
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'], 'approved')

    expect(screen.getByText('🎉 Your teacher said yes!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hand in/i })).not.toBeInTheDocument()
  })

  it('lets a student hand in again after being sent back', () => {
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'], 'needs_work')

    expect(screen.getByText(/Your teacher asked for one more change/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hand in my homework' })).toBeEnabled()
  })

  it('surfaces a server refusal', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Finish your homework tasks first' }) })
    renderHomework([...CORE_DONE, 'hw-one', 'hw-two'])

    fireEvent.click(screen.getByRole('button', { name: 'Hand in my homework' }))

    expect(await screen.findByText('Finish your homework tasks first')).toBeInTheDocument()
  })

  it('shows the deadline derived from the class schedule', () => {
    render(
      <Navigator
        lesson={homeworkLesson}
        projectId="project-1"
        code="intro anchor"
        initialCompletedTaskIds={CORE_DONE}
        onHighlight={jest.fn()}
        onPrompt={jest.fn()}
        classSlots={[{ day_of_week: (new Date().getDay() + 2) % 7, start_time: '16:00:00' }]}
      />,
    )

    expect(screen.getByText(/^Hand in before /)).toBeInTheDocument()
  })

  it('says nothing about a deadline when the student has no class', () => {
    renderHomework(CORE_DONE)

    expect(screen.queryByText(/^Hand in (before|today|by)/)).not.toBeInTheDocument()
  })

  it('drops the deadline once the homework is handed in', () => {
    render(
      <Navigator
        lesson={homeworkLesson}
        projectId="project-1"
        code="intro anchor"
        initialCompletedTaskIds={[...CORE_DONE, 'hw-one', 'hw-two']}
        onHighlight={jest.fn()}
        onPrompt={jest.fn()}
        initialSubmissionStatus="submitted"
        classSlots={[{ day_of_week: (new Date().getDay() + 2) % 7, start_time: '16:00:00' }]}
      />,
    )

    expect(screen.queryByText(/^Hand in before /)).not.toBeInTheDocument()
    expect(screen.getByText('Handed in. Your teacher will look soon.')).toBeInTheDocument()
  })
})
