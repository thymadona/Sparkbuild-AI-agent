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

describe('LessonDetailClient', () => {
  it('resumes an existing project without fetching a template', () => {
    render(<LessonDetailClient lesson={lesson} existingProjectId="existing-project" />)

    fireEvent.click(screen.getByRole('button', { name: 'Resume lesson' }))

    expect(push).toHaveBeenCalledWith('/editor/existing-project')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('creates a project for a first-time lesson', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ text: jest.fn().mockResolvedValue('<html>template</html>') })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ id: 'new-project' }) })

    render(<LessonDetailClient lesson={lesson} existingProjectId={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/editor/new-project'))
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/templates/personal-page.html')
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/projects', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toMatchObject({ lessonId: 1, lessonVersion: 2 })
  })
})
