'use client'

import { useState } from 'react'
import type { Lesson, LessonTask, LessonTaskType } from '@/lib/lessons'

interface NavigatorProps {
  lesson: Lesson
  projectId: string
  code: string
  initialCompletedTaskIds: string[]
  onHighlight: (line: number | null) => void
  onPrompt: (prompt: string) => void
}

const HELP_CHIPS = [
  { label: 'Explain this code', prompt: 'Can you explain what this code does in simple terms?' },
  { label: 'Fix an error', prompt: "I'm getting an error in my code. Can you help me fix it?" },
  { label: 'Suggest a next step', prompt: 'What is one small next step I can try without you writing the code for me?' },
]

const TASK_LABELS: Record<LessonTaskType, string> = {
  core: 'Core mission',
  choice: 'Make it yours',
  bonus: 'Bonus challenge',
}

function firstUnfinishedTaskIndex(tasks: LessonTask[], completed: Set<string>) {
  const unfinishedCore = tasks.findIndex((task) => task.type === 'core' && !completed.has(task.id))
  if (unfinishedCore >= 0) return unfinishedCore
  const unfinishedOptional = tasks.findIndex((task) => !completed.has(task.id))
  return unfinishedOptional >= 0 ? unfinishedOptional : 0
}

export default function Navigator({ lesson, projectId, code, initialCompletedTaskIds, onHighlight, onPrompt }: NavigatorProps) {
  const [done, setDone] = useState(() => new Set(initialCompletedTaskIds))
  const [activeIndex, setActiveIndex] = useState(() => firstUnfinishedTaskIndex(lesson.tasks, new Set(initialCompletedTaskIds)))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const coreTasks = lesson.tasks.filter((task) => task.type === 'core')
  const completedCore = coreTasks.filter((task) => done.has(task.id)).length
  const bonusTasks = lesson.tasks.filter((task) => task.type === 'bonus')
  const completedBonus = bonusTasks.filter((task) => done.has(task.id)).length
  const coreComplete = completedCore === coreTasks.length
  const allDone = done.size === lesson.tasks.length
  const activeTask = lesson.tasks[activeIndex]

  function activateTask(index: number) {
    const task = lesson.tasks[index]
    if (!task || done.has(task.id)) return
    setActiveIndex(index)
    const lineIndex = code.split('\n').findIndex((line) => line.includes(task.commentAnchor))
    onHighlight(lineIndex >= 0 ? lineIndex + 1 : null)
    onPrompt(task.prompt)
  }

  async function markDone(index: number) {
    const task = lesson.tasks[index]
    if (!task || done.has(task.id) || isSaving) return

    const nextDone = new Set(done)
    nextDone.add(task.id)
    setDone(nextDone)
    setSaveError(null)
    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/lesson-progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedTaskIds: Array.from(nextDone) }),
      })
      if (!response.ok) throw new Error('Could not save progress')
      const nextIndex = firstUnfinishedTaskIndex(lesson.tasks, nextDone)
      setActiveIndex(nextIndex)
    } catch {
      setDone(done)
      setSaveError('Your task was not saved. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-sm font-semibold text-fg-primary truncate">{lesson.title}</p>
            <p className="shrink-0 text-xs text-fg-muted">{completedCore}/{coreTasks.length} core</p>
          </div>
          <div className="h-1.5 rounded-full bg-surface-700" aria-label="Core task progress">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-300"
              style={{ width: `${coreTasks.length ? (completedCore / coreTasks.length) * 100 : 0}%` }}
            />
          </div>
          {bonusTasks.length > 0 && (
            <p className="mt-2 text-xs text-fg-muted">Bonus challenges: {completedBonus}/{bonusTasks.length}</p>
          )}
        </div>

        {coreComplete && (
          <div className="rounded-xl border border-teal-500/25 bg-teal-50 px-4 py-3 text-center dark:bg-teal-900/20">
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">🎉 Core mission complete!</p>
            <p className="mt-1 text-xs text-teal-700/80 dark:text-teal-300/80">Your project works. Try a creative choice or bonus when you are ready.</p>
          </div>
        )}

        {allDone && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-50 px-4 py-3 text-center dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">✨ Every challenge complete. Nice work!</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {lesson.tasks.map((task, index) => {
            const isDone = done.has(task.id)
            const isActive = activeIndex === index && !isDone
            return (
              <button
                key={task.id}
                onClick={() => activateTask(index)}
                disabled={isDone}
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${
                  isDone
                    ? 'bg-transparent text-fg-muted'
                    : isActive
                      ? 'bg-brand-500/15 text-fg-primary ring-1 ring-brand-400'
                      : 'bg-surface-700/60 text-fg-muted hover:bg-surface-700 hover:text-fg-secondary'
                }`}
              >
                <span className={`mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                  isDone ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-500' : isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300' : 'bg-surface-700 text-fg-muted'
                }`}>
                  {isDone ? '✓' : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{TASK_LABELS[task.type]}</span>
                  <span className={isDone ? 'line-through' : ''}>{task.chip}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-fg-muted">Ask your AI tutor</p>
          <div className="flex flex-col gap-1.5">
            {HELP_CHIPS.map((chip) => (
              <button key={chip.label} onClick={() => onPrompt(chip.prompt)} className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-fg-muted hover:bg-surface-700 hover:text-fg-secondary transition-colors">
                <span className="text-brand-500">✦</span>{chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTask && !done.has(activeTask.id) && (
        <div className="shrink-0 border-t border-surface-600 p-3">
          {saveError && <p className="mb-2 text-center text-xs text-red-500">{saveError}</p>}
          <p className="mb-2 rounded-md bg-surface-700/60 px-2 py-1.5 text-center text-xs text-fg-secondary">Goal: {activeTask.success}</p>
          <p className="mb-2 text-center text-xs text-fg-muted">Finished <span className="text-fg-secondary">{activeTask.chip}</span>?</p>
          <button onClick={() => markDone(activeIndex)} disabled={isSaving} className="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition-colors">
            {isSaving ? 'Saving…' : 'Mark done ✓'}
          </button>
        </div>
      )}
    </div>
  )
}
