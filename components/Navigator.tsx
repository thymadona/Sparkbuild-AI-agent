'use client'

import type { Lesson } from '@/lib/lessons'
import { SCALE, TASK_LABELS } from '@/lib/lesson-ui'
import ActiveTaskPanel from '@/components/ActiveTaskPanel'
import type { useLessonProgress } from '@/hooks/useLessonProgress'

interface NavigatorProps {
  lesson: Lesson
  code: string
  // Larger type and one-task-at-a-time, for younger students.
  kidMode?: boolean
  progress: ReturnType<typeof useLessonProgress>
}

export default function Navigator({ lesson, code, kidMode = false, progress }: NavigatorProps) {
  const { done, activeIndex, activeTask, isSaving, saveError, activateTask, markDone } = progress
  const type = kidMode ? SCALE.kid : SCALE.pro

  const coreTasks = lesson.tasks.filter((task) => task.type === 'core')
  const completedCore = coreTasks.filter((task) => done.has(task.id)).length
  const bonusTasks = lesson.tasks.filter((task) => task.type === 'bonus')
  const completedBonus = bonusTasks.filter((task) => done.has(task.id)).length
  const coreComplete = completedCore === coreTasks.length
  const allDone = done.size === lesson.tasks.length

  const showActivePanel = activeTask && !done.has(activeTask.id) && activeTask.type !== 'homework'

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className={`${kidMode ? 'text-base' : 'text-sm'} font-semibold text-fg-primary truncate`}>{lesson.title}</p>
            <p className={`shrink-0 ${type.meta} text-fg-muted`}>{completedCore}/{coreTasks.length} core</p>
          </div>
          <div className={`${kidMode ? 'h-2.5' : 'h-1.5'} rounded-full bg-surface-700`} aria-label="Core task progress">
            <div
              className={`${kidMode ? 'h-2.5' : 'h-1.5'} rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-300`}
              style={{ width: `${coreTasks.length ? (completedCore / coreTasks.length) * 100 : 0}%` }}
            />
          </div>
          {bonusTasks.length > 0 && (
            <p className={`mt-2 ${type.meta} text-fg-muted`}>Bonus challenges: {completedBonus}/{bonusTasks.length}</p>
          )}
        </div>

        {coreComplete && (
          <div className="rounded-xl border border-teal-500/25 bg-teal-50 px-4 py-3 text-center dark:bg-teal-900/20">
            <p className={`${kidMode ? 'text-base' : 'text-sm'} font-semibold text-teal-700 dark:text-teal-300`}>🎉 Core mission complete!</p>
            <p className={`mt-1 ${type.meta} text-teal-700/80 dark:text-teal-300/80`}>Your project works. Try a creative choice or bonus when you are ready.</p>
          </div>
        )}

        {allDone && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-50 px-4 py-3 text-center dark:bg-amber-900/20">
            <p className={`${kidMode ? 'text-base' : 'text-sm'} font-semibold text-amber-700 dark:text-amber-300`}>✨ Every challenge complete. Nice work!</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {lesson.tasks.map((task, index) => {
            if (task.type === 'homework') return null
            const isDone = done.has(task.id)
            const isActive = activeIndex === index && !isDone
            return (
              <button
                key={task.id}
                onClick={() => activateTask(index)}
                disabled={isDone}
                className={`flex items-start gap-3 rounded-lg px-3 text-left transition-colors disabled:cursor-default ${
                  kidMode && isActive ? 'py-4' : 'py-2.5'
                } ${type.chip} ${
                  isDone
                    ? 'bg-transparent text-fg-muted'
                    : isActive
                      ? 'bg-brand-500/15 text-fg-primary ring-1 ring-brand-400'
                      : 'bg-surface-700/60 text-fg-muted hover:bg-surface-700 hover:text-fg-secondary'
                }`}
              >
                <span className={`mt-0.5 shrink-0 flex items-center justify-center rounded-full font-medium ${
                  kidMode ? 'h-7 w-7 text-sm' : 'h-5 w-5 text-xs'
                } ${
                  isDone ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-500' : isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300' : 'bg-surface-700 text-fg-muted'
                }`}>
                  {isDone ? '✓' : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block ${type.label} text-fg-muted`}>{TASK_LABELS[task.type]}</span>
                  <span className={isDone ? 'line-through' : ''}>{task.chip}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {showActivePanel && (
        <ActiveTaskPanel
          task={activeTask}
          code={code}
          kidMode={kidMode}
          isSaving={isSaving}
          saveError={saveError}
          onMarkDone={() => markDone(activeIndex)}
        />
      )}
    </div>
  )
}
