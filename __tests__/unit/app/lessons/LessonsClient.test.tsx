/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LessonsClient from '@/app/lessons/LessonsClient'
import type { Lesson } from '@/lib/lessons'

const push = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/lessons',
}))

jest.mock('@/components/ThemeToggle', () => () => <div />)

const lesson: Lesson = {
  id: 1,
  title: 'Week #1 — Personal Page',
  description: 'Make a page.',
  templateFile: 'personal-page.html',
  tasks: [],
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('LessonsClient', () => {
  it('resumes the newest existing lesson project without creating another', () => {
    render(
      <LessonsClient
        lessons={[lesson]}
        userProjects={[
          { id: 'newest-project', lesson_id: 1, updated_at: '2026-04-02T00:00:00.000Z' },
          { id: 'older-project', lesson_id: 1, updated_at: '2026-04-01T00:00:00.000Z' },
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resume →' }))

    expect(push).toHaveBeenCalledWith('/editor/newest-project')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('creates a project from the template when the lesson has not started', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ text: jest.fn().mockResolvedValue('<html>template</html>') })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ id: 'new-project' }) })

    render(<LessonsClient lessons={[lesson]} userProjects={[]} enabledLessonIds={[1]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/editor/new-project'))
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/templates/personal-page.html')
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/projects', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toMatchObject({ lessonId: 1, lessonVersion: 2 })
  })

  it('shows a locked state instead of Start when the class has not turned the lesson on', () => {
    render(<LessonsClient lessons={[lesson]} userProjects={[]} enabledLessonIds={[]} />)

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.getByText('Not open yet')).toBeInTheDocument()
  })

  it('still lets a student resume a lesson they already started, even if since turned off', () => {
    render(
      <LessonsClient
        lessons={[lesson]}
        userProjects={[{ id: 'in-progress', lesson_id: 1, updated_at: '2026-04-02T00:00:00.000Z' }]}
        enabledLessonIds={[]}
      />
    )

    expect(screen.getByRole('button', { name: 'Resume →' })).toBeInTheDocument()
  })
})
