/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Homework from '@/components/Homework'
import { useLessonProgress } from '@/hooks/useLessonProgress'
import type { Lesson } from '@/lib/lessons'
import type { SubmissionStatus } from '@/types'
import type { ClassSlot } from '@/lib/schedule'

const lesson: Lesson = {
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

// Homework is a thin presentational shell over useLessonProgress, shared with
// Navigator in the real app (EditorLayout calls the hook once). This harness
// reproduces that wiring for the panel in isolation.
function Harness({ completedTaskIds, code = 'intro anchor', submission = null, classSlots }: {
  completedTaskIds: string[]
  code?: string
  submission?: SubmissionStatus | null
  classSlots?: ClassSlot[]
}) {
  const progress = useLessonProgress({
    lesson,
    projectId: 'project-1',
    code,
    initialCompletedTaskIds: completedTaskIds,
    initialSubmissionStatus: submission,
    onHighlight: jest.fn(),
    onPrompt: jest.fn(),
  })
  return <Homework lesson={lesson} code={code} progress={progress} classSlots={classSlots} />
}

function renderHomework(completedTaskIds: string[], submission: SubmissionStatus | null = null, classSlots?: ClassSlot[]) {
  render(<Harness completedTaskIds={completedTaskIds} submission={submission} classSlots={classSlots} />)
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn() })
})

describe('Homework', () => {
  it('keeps homework closed until the core mission is done', () => {
    renderHomework([])

    expect(screen.getByText('Finish your mission first. Then homework opens.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hand in my homework/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Add one new thing to your page.')).not.toBeInTheDocument()
  })

  it('shows the homework count even while locked', () => {
    renderHomework([], null)

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

  it('renders Mark done disabled for a homework task until the check passes', () => {
    renderHomework(CORE_DONE)

    expect(screen.getByRole('button', { name: /not yet/i })).toBeDisabled()
  })

  it('completes a homework task once the student clicks Mark done', async () => {
    render(<Harness completedTaskIds={CORE_DONE} code="intro anchor\nHW_ONE_DONE" />)

    fireEvent.click(await screen.findByRole('button', { name: /mark done/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/lesson-progress',
      expect.objectContaining({ method: 'PUT' }),
    ))
    expect(await screen.findByText('Homework · 1/2')).toBeInTheDocument()
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
    renderHomework(CORE_DONE, null, [{ day_of_week: (new Date().getDay() + 2) % 7, start_time: '16:00:00' }])

    expect(screen.getByText(/^Hand in before /)).toBeInTheDocument()
  })

  it('says nothing about a deadline when the student has no class', () => {
    renderHomework(CORE_DONE)

    expect(screen.queryByText(/^Hand in (before|today|by)/)).not.toBeInTheDocument()
  })

  it('drops the deadline once the homework is handed in', () => {
    renderHomework(
      [...CORE_DONE, 'hw-one', 'hw-two'],
      'submitted',
      [{ day_of_week: (new Date().getDay() + 2) % 7, start_time: '16:00:00' }],
    )

    expect(screen.queryByText(/^Hand in before /)).not.toBeInTheDocument()
    expect(screen.getByText('Handed in. Your teacher will look soon.')).toBeInTheDocument()
  })
})
