'use client'

import { useEffect, useState } from 'react'
import type { LessonTask } from '@/lib/lessons'
import type { TaskCheckResult } from '@/lib/task-checks'
import SpeakButton from '@/components/SpeakButton'

// Long enough that it is not the first thing a student reaches for, short
// enough that nobody sits stuck through a whole lesson. Restarts per task.
const STUCK_DELAY_MS = 90_000

interface Props {
  task: LessonTask
  results: TaskCheckResult[]
  evaluated: boolean
  done: boolean
  // Concept steps are still showing: there is no editor yet, so nothing to be stuck on.
  waiting?: boolean
  onStuck: () => void
  // Present on optional tasks only. A choice or bonus a student does not want
  // must not wall off the homework behind it.
  onSkip?: () => void
  // A refusal from the server, which has the last word on whether a task is done.
  error?: string | null
  busy: boolean
}

/**
 * The page's main heading: which task this page is for, and exactly what is
 * still missing. The board has no task list and no Mark done button — a page
 * is a task, and it completes itself when every line below is ticked. That
 * makes the checklist the only thing telling a student why they have not moved
 * on yet, so it is never hidden.
 */
export default function TaskHeader({ task, results, evaluated, done, waiting = false, onStuck, onSkip, error, busy }: Props) {
  const [canAskForHelp, setCanAskForHelp] = useState(false)
  const [asked, setAsked] = useState(false)

  // The escape hatch. Checks fail open when they cannot run, but a check that
  // runs and is wrong would otherwise dead-end a child with nothing to click.
  useEffect(() => {
    setCanAskForHelp(false)
    setAsked(false)
    if (waiting) return
    const t = setTimeout(() => setCanAskForHelp(true), STUCK_DELAY_MS)
    return () => clearTimeout(t)
  }, [task.id, waiting])

  return (
    <header className="mb-6 border-b-2 border-[#e4d3b3] pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mt-1 text-2xl font-bold leading-tight text-[#2b2118]">{task.chip}</h1>
          <p className="mt-1 text-base text-[#5c4f3d]">{task.success}</p>
        </div>
        <SpeakButton text={`${task.chip}. ${task.success}`} label="Read this task out loud" />
      </div>

      {results.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-base">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  r.passed ? 'bg-teal-500 text-white' : 'border-2 border-[#c9b892] text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className={r.passed ? 'text-[#7a6a52] line-through' : 'text-[#2b2118]'}>{r.label}</span>
                {!r.passed && r.hint && <span className="block text-sm text-[#7a6a52]">{r.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-base text-red-700">{error}</p>}

      {!evaluated && !done && results.length === 0 && (
        <p className="mt-4 text-base text-[#7a6a52]">Checking your code…</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canAskForHelp && !done && (
          <button
            onClick={() => { setAsked(true); onStuck() }}
            disabled={busy || asked}
            className="min-h-11 rounded-xl border-2 border-[#2b2118] px-4 text-sm font-bold text-[#2b2118] transition-colors hover:bg-[#e4d3b3] disabled:opacity-50"
          >
            {asked ? 'Asking Spark…' : 'I am stuck — show me'}
          </button>
        )}
        {onSkip && !done && (
          <button onClick={onSkip} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[#7a6a52] underline transition-colors hover:text-[#2b2118]">
            Skip this one
          </button>
        )}
      </div>
    </header>
  )
}
