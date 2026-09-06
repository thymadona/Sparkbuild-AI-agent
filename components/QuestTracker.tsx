'use client'

import { Sparkles } from 'lucide-react'
import type { Lesson } from '@/lib/lessons'

interface QuestTrackerProps {
  lesson: Lesson
  done: Set<string>
}

/**
 * Always-visible progress HUD — unlike Navigator's checklist, this stays on
 * screen whichever tab (Code/Preview/Chat) a student is looking at, so
 * progress is never hidden behind a panel they've switched away from.
 * Homework isn't counted: it's a separate, later phase of the lesson.
 */
export default function QuestTracker({ lesson, done }: QuestTrackerProps) {
  const tasks = lesson.tasks.filter((task) => task.type !== 'homework')
  const completed = tasks.filter((task) => done.has(task.id)).length

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-surface-600 bg-surface-700 px-2.5 py-1 shadow-hard-sm"
      title={`${completed} of ${tasks.length} sparks collected`}
    >
      <div className="flex items-center gap-0.5">
        {tasks.map((task) => (
          <Sparkles
            key={task.id}
            className={`h-3.5 w-3.5 ${done.has(task.id) ? 'text-amber-400' : 'text-surface-500'}`}
            fill={done.has(task.id) ? 'currentColor' : 'none'}
          />
        ))}
      </div>
      <span className="text-[10px] font-bold text-fg-secondary">
        {completed}/{tasks.length}
      </span>
    </div>
  )
}
