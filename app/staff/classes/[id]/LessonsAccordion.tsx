'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LessonProgressEntry } from './page'

const TYPE_LABEL: Record<string, string> = {
  homework: 'Homework',
  bonus: 'Bonus',
  choice: 'Choice',
}

export default function LessonsAccordion({
  classId,
  lessons,
}: {
  classId: string
  lessons: LessonProgressEntry[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<number>>(new Set(lessons[0] ? [lessons[0].lessonId] : []))
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleExpanded(lessonId: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      return next
    })
  }

  async function toggleEnabled(lessonId: number, nextEnabled: boolean) {
    if (busyId !== null) return
    setBusyId(lessonId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/classes/${classId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, enabled: nextEnabled }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not update the lesson')
      }
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
          Turn a week on when the class is ready for it, and click a week to see how every student is doing on it —
          including their homework.
        </p>
      </div>
      {error && (
        <div className="mx-5 mt-3 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-300">{error}</div>
      )}
      <div className="divide-y divide-gray-800">
        {lessons.map((lesson) => {
          const isOpen = expanded.has(lesson.lessonId)
          return (
            <div key={lesson.lessonId}>
              <div className="flex items-center gap-4 px-5 py-3">
                <button
                  onClick={() => toggleExpanded(lesson.lessonId)}
                  className="flex flex-1 items-center justify-between gap-4 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-100">{lesson.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{lesson.description}</p>
                  </div>
                  <span className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </button>
                <button
                  onClick={() => toggleEnabled(lesson.lessonId, !lesson.enabled)}
                  disabled={busyId !== null}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    lesson.enabled
                      ? 'bg-teal-950 border border-teal-800 text-teal-300 hover:bg-teal-900'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {busyId === lesson.lessonId ? '…' : lesson.enabled ? 'On' : 'Off'}
                </button>
              </div>

              {isOpen && (
                <div className="space-y-2 bg-gray-950/40 px-5 py-3">
                  {lesson.students.length === 0 ? (
                    <p className="text-xs text-gray-600">No students in this class yet.</p>
                  ) : (
                    lesson.students.map((s) => {
                      const doneCount = s.tasks.filter((t) => t.done).length
                      return (
                        <div key={s.userId} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-gray-100">{s.name || s.email}</span>
                            <span className="shrink-0 text-xs text-gray-500">
                              {doneCount}/{s.tasks.length} tasks
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                            {s.tasks.map((t) => (
                              <label key={t.id} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={t.done}
                                  disabled
                                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-700 bg-gray-800 accent-teal-500"
                                />
                                <span className={t.done ? 'text-gray-300' : 'text-gray-500'}>{t.chip}</span>
                                {t.type !== 'core' && (
                                  <span
                                    className={`shrink-0 rounded px-1 py-0.5 text-[10px] leading-none ${
                                      t.type === 'homework'
                                        ? 'bg-amber-950 border border-amber-800 text-amber-400'
                                        : 'bg-gray-800 border border-gray-700 text-gray-400'
                                    }`}
                                  >
                                    {TYPE_LABEL[t.type] ?? t.type}
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
