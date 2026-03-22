'use client'

import { useState } from 'react'
import type { Lesson } from '@/lib/lessons'

interface NavigatorProps {
  lesson: Lesson
  code: string
  onHighlight: (line: number | null) => void
  onPrompt: (prompt: string) => void
}

const HELP_CHIPS = [
  { label: 'Explain what this code does', prompt: 'Can you explain what this code does in simple terms?' },
  { label: 'Fix the error', prompt: "I'm getting an error in my code. Can you help me fix it?" },
  { label: 'Start over', prompt: 'I want to start fresh. Can you explain how to reset and begin again?' },
]

export default function Navigator({ lesson, code, onHighlight, onPrompt }: NavigatorProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [done, setDone] = useState<Set<number>>(new Set())

  function activateTask(index: number) {
    setActiveIndex(index)
    const task = lesson.tasks[index]
    const lines = code.split('\n')
    const lineIndex = lines.findIndex((line) => line.includes(task.commentAnchor))
    onHighlight(lineIndex >= 0 ? lineIndex + 1 : null)
    onPrompt(task.prompt)
  }

  function markDone(index: number) {
    const next = new Set(done)
    next.add(index)
    setDone(next)
    const nextIndex = index + 1
    if (nextIndex < lesson.tasks.length) {
      activateTask(nextIndex)
    }
  }

  const activeTask = !done.has(activeIndex) ? lesson.tasks[activeIndex] : null
  const allDone = done.size === lesson.tasks.length

  return (
    <div className="flex h-full flex-col">

      {/* Task list — scrollable */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">

        {/* Progress header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">
              {lesson.title}
            </p>
            <p className="text-xs text-gray-400">
              {done.size}/{lesson.tasks.length}
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-gray-800">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-300"
              style={{ width: `${(done.size / lesson.tasks.length) * 100}%` }}
            />
          </div>
        </div>

        {allDone && (
          <div className="rounded-xl border border-teal-500/40 bg-teal-900/20 px-4 py-4 text-center animate-pop-in">
            <p className="text-sm text-teal-300">🎉 All done! You completed every task in this lesson.</p>
          </div>
        )}

        {/* Task chips */}
        <div className="flex flex-col gap-1.5">
          {lesson.tasks.map((task, i) => {
            const isDone = done.has(i)
            const isActive = activeIndex === i && !isDone

            return (
              <button
                key={task.id}
                onClick={() => !isDone && activateTask(i)}
                disabled={isDone}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${
                  isDone
                    ? 'bg-transparent text-gray-600'
                    : isActive
                    ? 'bg-brand-500/15 text-white ring-1 ring-brand-400'
                    : 'bg-gray-800/60 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                {/* Status indicator */}
                <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border text-xs font-medium ${
                  isDone ? 'border-green-800 bg-green-950 text-green-500' : isActive ? 'border-brand-400 bg-brand-900 text-brand-300' : 'border-gray-700 bg-gray-900 text-gray-500'
                }`}>
                  {isDone ? (
                    <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-xs ${isActive ? 'text-brand-300' : 'text-gray-600'}`}>{i + 1}</span>
                  )}
                </span>
                <span className={isDone ? 'line-through' : ''}>{task.chip}</span>
              </button>
            )
          })}
        </div>

        {/* Help chips */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gray-600 mb-1.5">
            Help
          </p>
          <div className="flex flex-col gap-1.5">
            {HELP_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => onPrompt(chip.prompt)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
              >
                <svg className="h-3.5 w-3.5 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Done, move on — pinned footer, only shown when a task is active */}
      {activeTask && !allDone && (
        <div className="shrink-0 border-t border-gray-800 p-3">
          <p className="text-xs text-gray-600 mb-2 text-center">
            Finished <span className="text-gray-400">{activeTask.chip}</span>?
          </p>
          <button
            onClick={() => markDone(activeIndex)}
            className="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 active:bg-teal-700 transition-colors"
          >
            Mark done ✓
          </button>
        </div>
      )}

    </div>
  )
}
