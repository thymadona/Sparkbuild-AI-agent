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

const lesson: Lesson = {
  id: 101,
  title: 'Week #1 — Wake the Robot',
  description: 'Wake Sparky up.',
  templateFile: 'py/w1.py',
  starterFile: 'main.py',
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
          { id: 'newest-project', lesson_id: 101, updated_at: '2026-04-02T00:00:00.000Z' },
          { id: 'older-project', lesson_id: 101, updated_at: '2026-04-01T00:00:00.000Z' },
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resume →' }))

    expect(push).toHaveBeenCalledWith('/board/newest-project')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('creates a project when the lesson has not started', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'new-project' }),
    })

    render(<LessonsClient lessons={[lesson]} userProjects={[]} enabledLessonIds={[101]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/board/new-project'))
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({ method: 'POST' })
    )
    // The server seeds the starter; the browser sends only which lesson.
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body).toMatchObject({ lessonId: 101 })
    expect(body).not.toHaveProperty('starter')
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
        userProjects={[
          { id: 'in-progress', lesson_id: 101, updated_at: '2026-04-02T00:00:00.000Z' },
        ]}
        enabledLessonIds={[]}
      />
    )

    expect(screen.getByRole('button', { name: 'Resume →' })).toBeInTheDocument()
  })
})
