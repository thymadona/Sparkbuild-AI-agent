'use client'

import { useMemo } from 'react'
import type { Lesson } from '@/lib/lessons'
import { dueLabel, nextClassMeeting, type ClassSlot } from '@/lib/schedule'
import type { SubmissionStatus } from '@/types'

interface Props {
  lesson: Lesson
  done: Set<string>
  submission: SubmissionStatus | null
  isSubmitting: boolean
  submitError: string | null
  onSubmit: (ready: boolean) => void
  classSlots: ClassSlot[]
}

/**
 * Hand-in, on the last homework page. The task panel used to own this; the
 * board has no panel, and homework is the one thing a student must actively
 * send rather than simply finish — a teacher reviews it.
 */
export default function HomeworkFooter({ lesson, done, submission, isSubmitting, submitError, onSubmit, classSlots }: Props) {
  const homework = lesson.tasks.filter((t) => t.type === 'homework')
  const complete = homework.filter((t) => done.has(t.id)).length
  const ready = homework.length > 0 && complete === homework.length
  // Resolved in the browser so the weekday matches the student's own clock.
  const due = useMemo(() => dueLabel(nextClassMeeting(classSlots)), [classSlots])

  return (
    <div className="mt-8 rounded-2xl border-2 border-[#e4d3b3] bg-[#faf4e6] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[#2b2118]">Homework</h2>
        <span className="text-sm text-[#7a6a52]">{complete}/{homework.length} done</span>
      </div>
      {lesson.homeworkBrief && <p className="mt-1 text-base text-[#5c4f3d]">{lesson.homeworkBrief}</p>}
      {due && submission !== 'approved' && submission !== 'submitted' && (
        <p className="mt-2 text-base font-medium text-amber-700">{due}</p>
      )}

      {submitError && <p className="mt-3 text-base text-red-600">{submitError}</p>}

      {submission === 'approved' ? (
        <p className="mt-4 text-base font-semibold text-teal-700">🎉 Your teacher said yes!</p>
      ) : submission === 'submitted' ? (
        <p className="mt-4 text-base text-[#7a6a52]">Handed in. Your teacher will look soon.</p>
      ) : (
        <>
          {submission === 'needs_work' && (
            <p className="mt-3 text-base text-amber-700">Your teacher asked for one more change. Spark can read it to you.</p>
          )}
          <button
            onClick={() => onSubmit(ready)}
            disabled={!ready || isSubmitting}
            className={`mt-4 min-h-11 w-full rounded-xl px-4 text-base font-bold transition-colors ${
              ready ? 'bg-[#2b2118] text-[#faf6ee] hover:bg-[#3b2a1c]' : 'bg-[#e4d3b3] text-[#7a6a52]'
            } disabled:cursor-not-allowed`}
          >
            {isSubmitting ? 'Handing in…' : ready ? 'Hand in my homework' : 'Finish both homework tasks first'}
          </button>
        </>
      )}
    </div>
  )
}
