'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LESSONS } from '@/lib/lessons'

interface Props {
  classId: string
  disabledLessonIds: number[]
}

export default function LessonsPanel({ classId, disabledLessonIds }: Props) {
  const router = useRouter()
  const [disabled, setDisabled] = useState(new Set(disabledLessonIds))
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(lessonId: number) {
    if (busyId !== null) return
    const nextDisabled = !disabled.has(lessonId)
    setBusyId(lessonId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/classes/${classId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, disabled: nextDisabled }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not update the lesson')
      }
      setDisabled((prev) => {
        const next = new Set(prev)
        if (nextDisabled) next.add(lessonId)
        else next.delete(lessonId)
        return next
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the lesson')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lessons</p>
        <p className="mt-0.5 text-xs text-gray-600">
          Turn a week off to hide it from this class until you turn it back on. Students already partway through a
          week keep their work either way.
        </p>
      </div>
      {error && (
        <div className="mx-5 mt-3 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-300">{error}</div>
      )}
      <div className="divide-y divide-gray-800">
        {LESSONS.map((lesson) => {
          const isOff = disabled.has(lesson.id)
          return (
            <div key={lesson.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-100">{lesson.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{lesson.description}</p>
              </div>
              <button
                onClick={() => toggle(lesson.id)}
                disabled={busyId !== null}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  isOff
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-teal-950 border border-teal-800 text-teal-300 hover:bg-teal-900'
                }`}
              >
                {busyId === lesson.id ? '…' : isOff ? 'Off' : 'On'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
