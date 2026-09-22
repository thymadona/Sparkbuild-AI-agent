'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentLessonProgress } from './page'

const TYPE_LABEL: Record<string, string> = {
  bonus: 'Bonus',
  choice: 'Choice',
}

export interface LessonRow {
  lessonId: number
  title: string
  description: string
  enabled: boolean
  // Present only for the teacher view — admin's toggle-only view omits it,
  // which also turns off the expand/checklist UI below.
  students?: StudentLessonProgress[]
}

interface Props {
  classId: string
  lessons: LessonRow[]
}

// Handles both the admin toggle-only view (page.tsx passes lessons with no
// `students`) and the teacher view with a per-student checklist
// (TeacherClassClient passes the existing LessonProgressEntry[] as-is) —
// merged from the former LessonsPanel/LessonsAccordion split, which
// duplicated the enable/disable fetch logic for no reason.
export default function LessonsPanel({ classId, lessons }: Props) {
  const router = useRouter()
  const showProgress = lessons.some((l) => l.students)
  const [expanded, setExpanded] = useState<Set<number>>(
    new Set(showProgress && lessons[0] ? [lessons[0].lessonId] : [])
  )
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
    <div className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lessons
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {showProgress
            ? 'Turn a week on when the class is ready for it, and click a week to see how every student is doing on it.'
            : 'Weeks start locked for a new class. Turn a week on when this class is ready for it. Students already partway through a week keep their work either way.'}
        </p>
      </div>
      {error && (
        <div className="mx-5 mt-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="divide-y divide-border">
        {lessons.map((lesson) => {
          const isOpen = expanded.has(lesson.lessonId)
          return (
            <div key={lesson.lessonId}>
              <div className="flex items-center gap-4 px-5 py-3">
                {lesson.students ? (
                  <button
                    onClick={() => toggleExpanded(lesson.lessonId)}
                    className="flex flex-1 items-center justify-between gap-4 text-left"
                  >
                    <LessonLabel lesson={lesson} />
                    <span
                      className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    >
                      ›
                    </span>
                  </button>
                ) : (
                  <div className="flex-1">
                    <LessonLabel lesson={lesson} />
                  </div>
                )}
                <button
                  onClick={() => toggleEnabled(lesson.lessonId, !lesson.enabled)}
                  disabled={busyId !== null}
                  className={`shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    lesson.enabled
                      ? 'border border-success/40 bg-success/10 text-success hover:bg-success/20'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {busyId === lesson.lessonId ? '…' : lesson.enabled ? 'On' : 'Off'}
                </button>
              </div>

              {lesson.students && isOpen && (
                <div className="space-y-2 bg-muted/40 px-5 py-3">
                  {lesson.students.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No students in this class yet.</p>
                  ) : (
                    lesson.students.map((s) => {
                      const doneCount = s.tasks.filter((t) => t.done).length
                      return (
                        <div key={s.userId} className="rounded border border-border bg-card p-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-foreground">
                              {s.name || s.email}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
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
                                  className="h-3.5 w-3.5 shrink-0 rounded border-input bg-background accent-success"
                                />
                                <span
                                  className={t.done ? 'text-foreground' : 'text-muted-foreground'}
                                >
                                  {t.chip}
                                </span>
                                {t.type !== 'core' && (
                                  <span className="shrink-0 rounded border border-border bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
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

function LessonLabel({ lesson }: { lesson: LessonRow }) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{lesson.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{lesson.description}</p>
    </div>
  )
}
