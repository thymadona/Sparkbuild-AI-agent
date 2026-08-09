'use client'

import { useMemo, useState } from 'react'
import type { Lesson } from '@/lib/lessons'
import { SCALE, TASK_LABELS } from '@/lib/lesson-ui'
import ActiveTaskPanel from '@/components/ActiveTaskPanel'
import SpeakButton from '@/components/SpeakButton'
import { dueLabel, nextClassMeeting, type ClassSlot } from '@/lib/schedule'
import type { useLessonProgress } from '@/hooks/useLessonProgress'

interface NavigatorProps {
  lesson: Lesson
  code: string
  progress: ReturnType<typeof useLessonProgress>
  // The student's weekly class slots. Homework is due before the next one.
  classSlots?: ClassSlot[]
}

export default function Navigator({ lesson, code, progress, classSlots = [] }: NavigatorProps) {
  const { done, activeIndex, activeTask, isSaving, saveError, submission, isSubmitting, submitError, activateTask, markDone, submitHomework } = progress
  const [homeworkOpen, setHomeworkOpen] = useState(false)

  const coreTasks = lesson.tasks.filter((task) => task.type === 'core')
  const completedCore = coreTasks.filter((task) => done.has(task.id)).length
  const bonusTasks = lesson.tasks.filter((task) => task.type === 'bonus')
  const completedBonus = bonusTasks.filter((task) => done.has(task.id)).length
  const coreComplete = completedCore === coreTasks.length
  const allDone = done.size === lesson.tasks.length

  const homework = lesson.tasks.filter((task) => task.type === 'homework')
  const completedHomework = homework.filter((task) => done.has(task.id)).length
  const homeworkReady = homework.length > 0 && completedHomework === homework.length
  // Resolved in the browser so the weekday matches the student's own clock.
  const due = useMemo(() => dueLabel(nextClassMeeting(classSlots)), [classSlots])

  // Active panel now covers any task type — homework included — since
  // useLessonProgress tracks one activeIndex across the whole list and only
  // ever lands on a homework task once every core task is done (see
  // firstUnfinishedTaskIndex). It stays pinned outside the scroll area (and
  // outside the homework overlay below) so Mark done is always reachable,
  // whichever task is active and however the homework panel is toggled.
  const showActivePanel = activeTask && !done.has(activeTask.id)
  const orderedTasks = lesson.tasks.filter((task) => task.type !== 'homework')
  const activeStep = activeTask && activeTask.type !== 'homework'
    ? orderedTasks.findIndex((task) => task.id === activeTask.id)
    : -1

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        <div>
          {activeStep >= 0 && (
            <span className="mb-2 inline-block rounded-full border-2 border-surface-600 bg-amber-300 px-3 py-0.5 text-xs font-bold text-slate-900 shadow-hard-sm">
              Step {activeStep + 1} of {orderedTasks.length}
            </span>
          )}
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-base font-semibold text-fg-primary truncate">{lesson.title}</p>
            <p className={`shrink-0 ${SCALE.meta} text-fg-muted`}>{completedCore}/{coreTasks.length} core</p>
          </div>
          <div className="h-2.5 rounded-full border-2 border-surface-600 bg-surface-700" aria-label="Core task progress">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-300"
              style={{ width: `${coreTasks.length ? (completedCore / coreTasks.length) * 100 : 0}%` }}
            />
          </div>
          {bonusTasks.length > 0 && (
            <p className={`mt-2 ${SCALE.meta} text-fg-muted`}>Bonus challenges: {completedBonus}/{bonusTasks.length}</p>
          )}
        </div>

        {coreComplete && (
          <div className="rounded-xl border-2 border-surface-600 bg-teal-50 px-4 py-3 text-center shadow-hard-sm dark:bg-teal-900/20">
            <p className="text-base font-semibold text-teal-700 dark:text-teal-300">🎉 Core mission complete!</p>
            <p className={`mt-1 ${SCALE.meta} text-teal-700/80 dark:text-teal-300/80`}>Your project works. Try a creative choice or bonus when you are ready.</p>
          </div>
        )}

        {allDone && (
          <div className="rounded-xl border-2 border-surface-600 bg-amber-50 px-4 py-3 text-center shadow-hard-sm dark:bg-amber-900/20">
            <p className="text-base font-semibold text-amber-700 dark:text-amber-300">✨ Every challenge complete. Nice work!</p>
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
                className={`flex items-start gap-2 rounded-lg border-2 px-2.5 py-2 text-left transition-all disabled:cursor-default ${SCALE.chip} ${
                  isDone
                    ? 'border-surface-600 bg-transparent text-fg-muted opacity-60'
                    : isActive
                      ? 'border-brand-500 bg-surface-800 text-fg-primary shadow-hard-sm'
                      : 'border-surface-600 bg-surface-700/60 text-fg-muted shadow-hard-sm hover:bg-surface-700 hover:text-fg-secondary'
                }`}
              >
                <span className={`mt-0.5 shrink-0 flex items-center justify-center rounded-full font-bold h-5 w-5 text-[11px] border-2 ${
                  isDone
                    ? 'border-surface-600 bg-teal-400 text-slate-900'
                    : isActive
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-surface-600 bg-surface-700 text-fg-muted'
                }`}>
                  {isDone ? '✓' : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block ${SCALE.label} text-fg-muted`}>{TASK_LABELS[task.type]}</span>
                  <span className={isDone ? 'line-through' : ''}>{task.chip}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Homework — a collapsed chip instead of an always-expanded card, so
            it doesn't compete with the task list and AI Tutor for scroll
            room. Locked (and un-openable) until every core task is done.
            Expands into an overlay scoped to this scroll area only — the
            pinned ActiveTaskPanel footer below stays visible either way. */}
        {homework.length > 0 && (
          <button
            onClick={() => coreComplete && setHomeworkOpen(true)}
            disabled={!coreComplete}
            className="flex items-center justify-between gap-2 rounded-lg border-2 border-surface-600 bg-surface-700/60 px-3 py-2 text-left shadow-hard-sm transition-all disabled:cursor-default disabled:opacity-60 enabled:hover:bg-surface-700 enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:shadow-none"
          >
            <span className="flex min-w-0 items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
              </svg>
              <span className={`${SCALE.label} text-fg-primary`}>Homework</span>
              <span className="text-xs text-fg-muted">{completedHomework}/{homework.length}</span>
            </span>
            {coreComplete ? (
              <svg className="h-4 w-4 shrink-0 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-xs text-fg-muted">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V7a4 4 0 018 0v3" />
                </svg>
                Locked
              </span>
            )}
          </button>
        )}

        {homeworkOpen && (
          <div className="absolute inset-0 z-10 flex flex-col rounded-lg bg-surface-800 animate-pop-in">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-surface-600 bg-surface-700 px-3 py-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-sm font-semibold text-fg-primary">Homework</span>
                <span className="text-xs text-fg-muted">{completedHomework}/{homework.length}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {lesson.homeworkBrief && <SpeakButton text={lesson.homeworkBrief} label="Read the homework out loud" />}
                <button
                  onClick={() => setHomeworkOpen(false)}
                  className="text-fg-muted hover:text-fg-secondary transition-colors p-1 rounded hover:bg-surface-600"
                  title="Close"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {lesson.homeworkBrief && (
                <p className={`mb-1 ${SCALE.check} text-fg-secondary`}>{lesson.homeworkBrief}</p>
              )}
              {due && submission !== 'approved' && submission !== 'submitted' && (
                <p className={`mb-2 ${SCALE.check} font-medium text-amber-600 dark:text-amber-400`}>{due}</p>
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
                      className={`flex items-start gap-2 rounded-lg border-2 px-2.5 py-2 text-left ${SCALE.check} transition-all disabled:cursor-default ${
                        isDone
                          ? 'border-surface-600 text-fg-muted opacity-60'
                          : isActive
                            ? 'border-brand-500 bg-surface-900 text-fg-primary shadow-hard-sm'
                            : 'border-surface-600 bg-surface-900/60 text-fg-muted shadow-hard-sm hover:bg-surface-900 hover:text-fg-secondary'
                      }`}
                    >
                      <span aria-hidden="true">{isDone ? '✓' : '○'}</span>
                      <span className={isDone ? 'line-through' : ''}>{task.chip.replace(/^Homework: /, '')}</span>
                    </button>
                  )
                })}
              </div>

              {submitError && <p className={`mb-1.5 ${SCALE.check} text-red-500`}>{submitError}</p>}

              {submission === 'approved' ? (
                <p className={`text-center ${SCALE.check} font-semibold text-teal-600 dark:text-teal-400`}>🎉 Your teacher said yes!</p>
              ) : submission === 'submitted' ? (
                <p className={`text-center ${SCALE.check} text-fg-muted`}>Handed in. Your teacher will look soon.</p>
              ) : (
                <>
                  {submission === 'needs_work' && (
                    <p className={`mb-1.5 ${SCALE.check} text-amber-600 dark:text-amber-400`}>Your teacher asked for one more change. Look in the chat.</p>
                  )}
                  <button
                    onClick={() => submitHomework(homeworkReady)}
                    disabled={!homeworkReady || isSubmitting}
                    className={`w-full rounded-lg border-2 border-surface-600 px-3 py-1.5 ${SCALE.button} font-bold shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-hard-sm ${
                      homeworkReady ? 'bg-brand-500 hover:bg-brand-400 text-white' : 'bg-surface-600 text-fg-secondary'
                    }`}
                  >
                    {isSubmitting ? 'Handing in…' : homeworkReady ? 'Hand in my homework' : 'Finish homework to hand in'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showActivePanel && (
        <ActiveTaskPanel
          task={activeTask}
          code={code}
          isSaving={isSaving}
          saveError={saveError}
          onMarkDone={() => markDone(activeIndex)}
        />
      )}
    </div>
  )
}
