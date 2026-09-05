/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { useLessonProgress } from '@/hooks/useLessonProgress'
import type { Lesson } from '@/lib/lessons'

const lesson: Lesson = {
  id: 1,
  title: 'Week #1',
  description: '',
  templateFile: 'personal-page.html',
  tasks: [
    { id: 'task-1', type: 'core', chip: '', success: '', prompt: '', commentAnchor: '' },
    { id: 'task-2', type: 'core', chip: '', success: '', prompt: '', commentAnchor: '' },
  ],
}

function setup(initialCompletedTaskIds: string[]) {
  return renderHook(() =>
    useLessonProgress({
      lesson,
      projectId: 'project-1',
      code: '',
      initialCompletedTaskIds,
      onHighlight: () => {},
      onPrompt: () => {},
    })
  )
}

describe('useLessonProgress resetProgress', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock
  })

  it('clears done tasks and re-activates the first task', async () => {
    const { result } = setup(['task-1', 'task-2'])
    expect(result.current.done.size).toBe(2)

    await act(async () => {
      await result.current.resetProgress()
    })

    expect(result.current.done.size).toBe(0)
    expect(result.current.activeIndex).toBe(0)
  })

  it('PUTs an empty completedTaskIds array to the server', async () => {
    const { result } = setup(['task-1'])

    await act(async () => {
      await result.current.resetProgress()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/project-1/lesson-progress',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ completedTaskIds: [] }),
      })
    )
  })

  it('surfaces a save error when the request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock
    const { result } = setup(['task-1'])

    await act(async () => {
      await result.current.resetProgress()
    })

    expect(result.current.saveError).toBe('Your task progress was not reset. Please try again.')
  })
})
