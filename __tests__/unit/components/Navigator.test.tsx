/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Navigator from '@/components/Navigator'
import type { Lesson } from '@/lib/lessons'

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
