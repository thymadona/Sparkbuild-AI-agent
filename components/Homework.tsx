'use client'

import { useMemo } from 'react'
import type { Lesson } from '@/lib/lessons'
import { SCALE } from '@/lib/lesson-ui'
import { dueLabel, nextClassMeeting, type ClassSlot } from '@/lib/schedule'
import SpeakButton from '@/components/SpeakButton'
import ActiveTaskPanel from '@/components/ActiveTaskPanel'
import type { useLessonProgress } from '@/hooks/useLessonProgress'

interface HomeworkProps {
  lesson: Lesson
  code: string
  kidMode?: boolean
  progress: ReturnType<typeof useLessonProgress>
  // The student's weekly class slots. Homework is due before the next one.
  classSlots?: ClassSlot[]
}

export default function Homework({ lesson, code, kidMode = false, progress, classSlots = [] }: HomeworkProps) {
  const { done, activeIndex, activeTask, isSaving, saveError, submission, isSubmitting, submitError, activateTask, markDone, submitHomework } = progress
  const type = kidMode ? SCALE.kid : SCALE.pro

  const coreTasks = lesson.tasks.filter((task) => task.type === 'core')
  const completedCore = coreTasks.filter((task) => done.has(task.id)).length
  const coreComplete = completedCore === coreTasks.length
  const homework = lesson.tasks.filter((task) => task.type === 'homework')
  const completedHomework = homework.filter((task) => done.has(task.id)).length
  const homeworkReady = homework.length > 0 && completedHomework === homework.length
  // Resolved in the browser so the weekday matches the student's own clock.
  const due = useMemo(() => dueLabel(nextClassMeeting(classSlots)), [classSlots])

  const showActivePanel = activeTask && !done.has(activeTask.id) && activeTask.type === 'homework'

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="rounded-xl border border-surface-600 bg-surface-700/40 p-3">
          <div className="mb-1.5 flex items-center gap-1">
            <p className={`flex-1 ${type.label} text-fg-muted`}>Homework · {completedHomework}/{homework.length}</p>
            {lesson.homeworkBrief && <SpeakButton text={lesson.homeworkBrief} label="Read the homework out loud" />}
          </div>

          {!coreComplete ? (
            <p className={`${type.check} text-fg-muted`}>Finish your mission first. Then homework opens.</p>
          ) : (
            <>
              {lesson.homeworkBrief && (
                <p className={`mb-1 ${type.check} text-fg-secondary`}>{lesson.homeworkBrief}</p>
              )}
              {due && submission !== 'approved' && submission !== 'submitted' && (
                <p className={`mb-2 ${type.check} font-medium text-amber-600 dark:text-amber-400`}>{due}</p>
              )}
              <div className="mb-2 flex flex-col gap-1.5">
                {homework.map((task) => {
                  const index = lesson.tasks.indexOf(task)
                  const isDone = done.has(task.id)
                  const isActive = activeIndex === index && !isDone
                  return (
                    <button
                      key={task.id}
                      onClick={() => activateTask(index)}
                      disabled={isDone}
                      className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-left ${type.check} transition-colors disabled:cursor-default ${
                        isDone
                          ? 'text-fg-muted'
                          : isActive
                            ? 'bg-brand-500/15 text-fg-primary ring-1 ring-brand-400'
                            : 'bg-surface-700/60 text-fg-muted hover:bg-surface-700 hover:text-fg-secondary'
                      }`}
                    >
                      <span aria-hidden="true">{isDone ? '✓' : '○'}</span>
                      <span className={isDone ? 'line-through' : ''}>{task.chip.replace(/^Homework: /, '')}</span>
                    </button>
                  )
                })}
              </div>

              {submitError && <p className={`mb-1.5 ${type.check} text-red-500`}>{submitError}</p>}

              {submission === 'approved' ? (
                <p className={`text-center ${type.check} font-semibold text-teal-600 dark:text-teal-400`}>🎉 Your teacher said yes!</p>
              ) : submission === 'submitted' ? (
                <p className={`text-center ${type.check} text-fg-muted`}>Handed in. Your teacher will look soon.</p>
              ) : (
                <>
                  {submission === 'needs_work' && (
                    <p className={`mb-1.5 ${type.check} text-amber-600 dark:text-amber-400`}>Your teacher asked for one more change. Look in the chat.</p>
                  )}
                  <button
                    onClick={() => submitHomework(homeworkReady)}
                    disabled={!homeworkReady || isSubmitting}
                    className={`w-full rounded-md px-4 ${kidMode ? 'py-2.5' : 'py-2'} ${type.button} font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      homeworkReady ? 'bg-brand-500 hover:bg-brand-600' : 'bg-surface-600'
                    }`}
                  >
                    {isSubmitting ? 'Handing in…' : homeworkReady ? 'Hand in my homework' : 'Finish homework to hand in'}
                  </button>
                </>
              )}
            </>
          )}
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
