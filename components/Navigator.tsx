'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Lesson, LessonTask, LessonTaskType } from '@/lib/lessons'
import { allChecksPassed, firstUnmetCheck, runTaskChecks } from '@/lib/task-checks'
import SpeakButton from '@/components/SpeakButton'
import type { SubmissionStatus } from '@/types'
import { dueLabel, nextClassMeeting, type ClassSlot } from '@/lib/schedule'

interface NavigatorProps {
  lesson: Lesson
  projectId: string
  code: string
  initialCompletedTaskIds: string[]
  onHighlight: (line: number | null) => void
  onPrompt: (prompt: string) => void
  // Larger type and one-task-at-a-time, for younger students.
  kidMode?: boolean
  initialSubmissionStatus?: SubmissionStatus | null
  // The student's weekly class slots. Homework is due before the next one.
  classSlots?: ClassSlot[]
}

// How long a student works on a checked task before the "stuck" escape hatch
// appears. Long enough that clicking through is not the easy path, short enough
// that a wrong check never traps anyone.
const STUCK_DELAY_MS = 90_000

const HELP_CHIPS = [
  { label: 'Explain this code', prompt: 'Can you explain what this code does in simple terms?' },
  { label: 'Fix an error', prompt: "I'm getting an error in my code. Can you help me fix it?" },
  { label: 'Suggest a next step', prompt: 'What is one small next step I can try without you writing the code for me?' },
]

const TASK_LABELS: Record<LessonTaskType, string> = {
  core: 'Core mission',
  choice: 'Make it yours',
  bonus: 'Bonus challenge',
  homework: 'Homework',
}

// Type scale. Kid mode keeps everything at 14px or larger and drops the
// letterspaced 10px caps, which are the hardest thing on screen to read.
const SCALE = {
  kid: { label: 'text-xs font-semibold', chip: 'text-lg leading-snug', goal: 'text-base', check: 'text-base', hint: 'text-base', button: 'text-lg', meta: 'text-sm' },
  pro: { label: 'text-[10px] font-semibold uppercase tracking-wider', chip: 'text-sm', goal: 'text-xs', check: 'text-xs', hint: 'text-xs', button: 'text-sm', meta: 'text-xs' },
}

function firstUnfinishedTaskIndex(tasks: LessonTask[], completed: Set<string>) {
  const unfinishedCore = tasks.findIndex((task) => task.type === 'core' && !completed.has(task.id))
  if (unfinishedCore >= 0) return unfinishedCore
  const unfinishedOptional = tasks.findIndex((task) => !completed.has(task.id))
  return unfinishedOptional >= 0 ? unfinishedOptional : 0
}

export default function Navigator({ lesson, projectId, code, initialCompletedTaskIds, onHighlight, onPrompt, kidMode = false, initialSubmissionStatus = null, classSlots = [] }: NavigatorProps) {
  const [done, setDone] = useState(() => new Set(initialCompletedTaskIds))
  const [activeIndex, setActiveIndex] = useState(() => firstUnfinishedTaskIndex(lesson.tasks, new Set(initialCompletedTaskIds)))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [timeElapsed, setTimeElapsed] = useState(false)
  const [hintRequested, setHintRequested] = useState(false)
  // Checks need a DOM, so they cannot run during server rendering. Evaluating
  // them only after mount keeps the server and first client render identical —
  // otherwise the fail-open path reports every check as passed on the server and
  // React throws a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  const [submission, setSubmission] = useState<SubmissionStatus | null>(initialSubmissionStatus)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const type = kidMode ? SCALE.kid : SCALE.pro
  const coreTasks = lesson.tasks.filter((task) => task.type === 'core')
  const completedCore = coreTasks.filter((task) => done.has(task.id)).length
  const bonusTasks = lesson.tasks.filter((task) => task.type === 'bonus')
  const completedBonus = bonusTasks.filter((task) => done.has(task.id)).length
  const homework = lesson.tasks.filter((task) => task.type === 'homework')
  // Resolved in the browser so the weekday matches the student's own clock.
  const due = useMemo(() => dueLabel(nextClassMeeting(classSlots)), [classSlots])
  const completedHomework = homework.filter((task) => done.has(task.id)).length
  const homeworkReady = homework.length > 0 && completedHomework === homework.length
  const coreComplete = completedCore === coreTasks.length
  const allDone = done.size === lesson.tasks.length
  const activeTask = lesson.tasks[activeIndex]

  useEffect(() => setMounted(true), [])

  const activeChecks = activeTask?.checks
  const hasChecks = (activeChecks?.length ?? 0) > 0
  const checkResults = useMemo(() => (mounted ? runTaskChecks(activeChecks, code) : []), [mounted, activeChecks, code])
  const checksEvaluated = hasChecks && checkResults.length > 0
  const passedChecks = checkResults.filter((result) => result.passed).length
  // Until the checks have actually run, treat the task as unfinished rather than
  // letting the button flash enabled.
  const checksSatisfied = !hasChecks || (checksEvaluated && allChecksPassed(checkResults))
  const unmetCheck = firstUnmetCheck(checkResults)
  // The escape hatch needs both: time on the task AND a hint request. Waiting
  // alone is not enough, so clicking through is never the path of least effort.
  const stuckUnlocked = timeElapsed && hintRequested
  const canMarkDone = checksSatisfied || stuckUnlocked

  // In kid mode only finished tasks and the current one are listed; everything
  // else collapses to a count so the panel holds one thing to do. Homework is
  // never in this list — it has its own section below.
  const isVisible = (task: LessonTask, index: number) =>
    task.type !== 'homework' && (!kidMode || done.has(task.id) || index === activeIndex)
  const upcomingCount = lesson.tasks.filter(
    (task, index) => task.type !== 'homework' && !isVisible(task, index),
  ).length

  useEffect(() => {
    setTimeElapsed(false)
    setHintRequested(false)
    if (!activeTask?.checks?.length) return
    const timer = setTimeout(() => setTimeElapsed(true), STUCK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [activeTask?.id, activeTask?.checks])

  function lineForTask(task: LessonTask) {
    const lineIndex = code.split('\n').findIndex((line) => line.includes(task.commentAnchor))
    return lineIndex >= 0 ? lineIndex + 1 : null
  }

  function activateTask(index: number) {
    const task = lesson.tasks[index]
    if (!task || done.has(task.id)) return
    setActiveIndex(index)
    onHighlight(lineForTask(task))
    onPrompt(task.prompt)
  }

  async function submitHomework() {
    if (!homeworkReady || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/submit`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not hand in your homework')
      setSubmission(data.submissionStatus ?? 'submitted')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not hand in your homework')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function markDone(index: number) {
    const task = lesson.tasks[index]
    if (!task || done.has(task.id) || isSaving) return
    if (!canMarkDone) return

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
            if (!isVisible(task, index)) return null
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
          {upcomingCount > 0 && (
            <p className={`px-3 pt-1 ${type.meta} text-fg-muted`}>
              {upcomingCount} more after this one.
            </p>
          )}
        </div>

        {homework.length > 0 && (
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
                      onClick={submitHomework}
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
        )}

        <div>
          <p className={`mb-1.5 ${type.label} text-fg-muted`}>Ask your AI tutor</p>
          <div className="flex flex-col gap-1.5">
            {HELP_CHIPS.map((chip) => (
              <button key={chip.label} onClick={() => onPrompt(chip.prompt)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-left ${type.check} text-fg-muted hover:bg-surface-700 hover:text-fg-secondary transition-colors`}>
                <span className="text-brand-500">✦</span>{chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTask && !done.has(activeTask.id) && (
        <div className="shrink-0 border-t border-surface-600 p-3">
          {saveError && <p className={`mb-2 text-center ${type.check} text-red-500`}>{saveError}</p>}
          <div className="mb-2 flex items-center gap-1 rounded-md bg-surface-700/60 px-2 py-1.5">
            <p className={`flex-1 ${type.goal} text-fg-secondary`}>Goal: {activeTask.success}</p>
            <SpeakButton text={activeTask.success} label="Read the goal out loud" />
          </div>

          {/* Pointing beats describing: send the student straight to the line. */}
          <button
            onClick={() => onHighlight(lineForTask(activeTask))}
            className={`mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-400/40 bg-brand-500/10 px-3 ${
              kidMode ? 'py-2.5' : 'py-1.5'
            } ${type.check} font-medium text-brand-700 transition-colors hover:bg-brand-500/20 dark:text-brand-300`}
          >
            <span aria-hidden="true">👉</span> Show me where
          </button>

          {hasChecks && !checksEvaluated && (
            <p className={`mb-2 text-center ${type.check} text-fg-muted`}>Checking your code…</p>
          )}

          {checksEvaluated && (
            <div className="mb-2">
              <p className={`mb-1.5 text-center ${type.label} text-fg-muted`}>
                Checked in your code: {passedChecks}/{checkResults.length}
              </p>
              <ul className="flex flex-col gap-1">
                {checkResults.map((result) => (
                  <li key={result.label} className={`flex items-start gap-2 ${type.check}`}>
                    <span
                      aria-hidden="true"
                      className={`mt-px shrink-0 flex items-center justify-center rounded-full font-bold ${
                        kidMode ? 'h-5 w-5 text-xs' : 'h-4 w-4 text-[10px]'
                      } ${
                        result.passed
                          ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-500'
                          : 'bg-surface-700 text-fg-muted'
                      }`}
                    >
                      {result.passed ? '✓' : '○'}
                    </span>
                    <span className={result.passed ? 'text-fg-muted line-through' : 'text-fg-secondary'}>
                      {result.label}
                      <span className="sr-only">{result.passed ? ' — done' : ' — not yet'}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div aria-live="polite">
                {unmetCheck ? (
                  <div className="mt-2 rounded-md border border-amber-500/25 bg-amber-50 px-2 py-1.5 dark:bg-amber-900/20">
                    <div className="flex items-start gap-1">
                      <p className={`flex-1 ${type.hint} text-amber-800 dark:text-amber-200`}>{unmetCheck.hint}</p>
                      <SpeakButton text={unmetCheck.hint} label="Read the hint out loud" className="hover:bg-amber-500/20" />
                    </div>
                    <button
                      onClick={() => {
                        setHintRequested(true)
                        onPrompt(`I am working on "${activeTask.chip}". ${unmetCheck.hint} Give me a hint that helps me do it myself — please do not write the code for me.`)
                      }}
                      className={`mt-1.5 ${type.meta} font-semibold text-amber-800 underline hover:no-underline dark:text-amber-200`}
                    >
                      Ask for a hint (not the answer)
                    </button>
                  </div>
                ) : (
                  <p className={`mt-2 text-center ${type.check} font-semibold text-teal-600 dark:text-teal-400`}>
                    Your code does it. Nice.
                  </p>
                )}
              </div>
            </div>
          )}

          {!hasChecks && (
            <p className={`mb-2 text-center ${type.check} text-fg-muted`}>Finished <span className="text-fg-secondary">{activeTask.chip}</span>?</p>
          )}

          <button
            onClick={() => markDone(activeIndex)}
            disabled={isSaving || !canMarkDone}
            className={`w-full rounded-md px-4 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              kidMode ? 'py-3' : 'py-2'
            } ${type.button} ${
              checksSatisfied ? 'bg-teal-600 hover:bg-teal-500' : 'bg-surface-600 hover:bg-surface-500'
            }`}
          >
            {isSaving ? 'Saving…' : checksSatisfied ? 'Mark done ✓' : stuckUnlocked ? 'Stuck? Mark done anyway' : 'Not yet — keep going'}
          </button>
        </div>
      )}
    </div>
  )
}
