/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LessonDetailClient from '@/app/lessons/[id]/LessonDetailClient'
import type { Lesson } from '@/lib/lessons'

const push = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
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

describe('LessonDetailClient', () => {
  it('resumes an existing project without fetching a template', () => {
    render(<LessonDetailClient lesson={lesson} existingProjectId="existing-project" />)

    fireEvent.click(screen.getByRole('button', { name: 'Resume lesson' }))

    expect(push).toHaveBeenCalledWith('/board/existing-project')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('creates a project for a first-time lesson', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'new-project' }),
    })

    render(<LessonDetailClient lesson={lesson} existingProjectId={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' }))

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
})
