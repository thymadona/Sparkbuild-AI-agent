'use client'

import PlayerCard from '@/components/PlayerCard'
import type { PlayerStats } from '@/lib/xp'
import { lessonDisplayTitle, type Lesson } from '@/lib/lessons'
import { openBoard } from '@/lib/open-board'
import { useState } from 'react'
import { Check, Compass, Lock } from 'lucide-react'
import AppShell from '@/components/AppShell'
import type { AccountLinks } from '@/lib/account-links'
import type { AccessPolicy } from '@/lib/lesson-availability'
import type { MyInvite } from '@/lib/org-invites'
import InviteBanner from '@/components/InviteBanner'

// A fixed per-lesson difficulty rating, not a score the student earns — kept
// visually distinct (muted, labeled) from the real completion state (the
// checkmark node and Resume button) so it can't be misread as "you only
// scored 1/3" on a finished project.
const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

interface Props {
  lessons: Lesson[]
  userProjects: { id: string; lesson_id: number | null; updated_at: string; done?: number }[]
  enabledLessonIds?: number[]
  userEmail?: string
  stats?: PlayerStats
  links?: AccountLinks
  // A school (class-only) opens lessons through its classes, not boss wins.
  policy?: AccessPolicy
  // Open invites to join a school (Direct users only).
  invites?: MyInvite[]
}

export default function LessonsClient({
  lessons,
  userProjects,
  enabledLessonIds = [],
  userEmail = '',
  stats,
  links,
  policy = 'self-paced',
  invites = [],
}: Props) {
  const classOnly = policy === 'class-only'
  const enabledSet = new Set(enabledLessonIds)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Projects arrive newest first, so the first project for each lesson is the resume target.
  const projectByLessonId = new Map<number, string>()
  for (const project of userProjects) {
    if (project.lesson_id !== null && !projectByLessonId.has(project.lesson_id)) {
      projectByLessonId.set(project.lesson_id, project.id)
    }
  }
  const doneByLessonId = new Map<number, number>()
  for (const project of userProjects) {
    if (project.lesson_id !== null)
      doneByLessonId.set(
        project.lesson_id,
        Math.max(doneByLessonId.get(project.lesson_id) ?? 0, project.done ?? 0)
      )
  }
  const doneOf = (l: Lesson) => Math.min(doneByLessonId.get(l.id) ?? 0, l.tasks.length)
  const lessonsStarted = lessons.filter((l) => projectByLessonId.has(l.id)).length
  const tasksTotal = lessons.reduce((n, l) => n + l.tasks.length, 0)
  const tasksDone = lessons.reduce((n, l) => n + doneOf(l), 0)

  async function handleStart(lesson: Lesson) {
    const existingProjectId = projectByLessonId.get(lesson.id)
    if (existingProjectId) {
      openBoard(existingProjectId)
      return
    }

    setLoadingId(lesson.id)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lessonDisplayTitle(lesson),
          lessonId: lesson.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403 && typeof data.error === 'string') {
        setError(data.error)
        setLoadingId(null)
        return
      }
      if (!res.ok) throw new Error('Failed to create project')
      openBoard(data.id)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoadingId(null)
    }
  }

  const total = lessons.length
  const progressPct = Math.round((tasksDone / tasksTotal) * 100)

  return (
    <AppShell userEmail={userEmail} xp={stats?.xp} links={links}>
      <InviteBanner invites={invites} />

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-fg-primary">
            Your Journey
          </h1>
          <p className="mt-2 text-lg text-fg-secondary">
            {classOnly
              ? 'Learn Python with your class. Your teacher opens new lessons.'
              : "Learn Python at your own pace. Beat a lesson's boss to open the next one."}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-fg-primary">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tint-sage">
            <Compass className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold leading-none">{progressPct}%</p>
            <p className="mt-1 text-xs font-semibold text-fg-secondary">
              {tasksDone}/{tasksTotal} tasks done
            </p>
          </div>
        </div>
      </div>

      {/* Global progress bar */}
      <div className="h-2.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Roadmap */}
        <div className="relative">
          <div className="absolute left-8 top-8 bottom-8 w-px bg-border" />
          <div className="space-y-5">
            {lessons.map((lesson, i) => {
              const isStarted = projectByLessonId.has(lesson.id)
              const isDone = doneOf(lesson) === lesson.tasks.length
              const isLocked = !isStarted && !enabledSet.has(lesson.id)
              const stars = Math.min(3, Math.floor(i / 4) + 1) // lessons 1-4 easy, 5-8 medium, 9+ hard
              return (
                <div key={lesson.id} className="flex gap-5 relative">
                  {/* Node */}
                  <div
                    className={`relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border text-lg font-bold transition-colors ${
                      isStarted
                        ? 'bg-tint-sage text-fg-primary'
                        : isLocked
                          ? 'bg-card text-fg-muted'
                          : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-6 w-6" />
                    ) : isLocked ? (
                      <Lock className="h-5 w-5" />
                    ) : (
                      String(i + 1)
                    )}
                  </div>
                  {/* Card */}
                  <div className="flex-1 rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold uppercase tracking-widest ${'text-fg-muted'}`}
                        >
                          Lesson {i + 1}
                        </p>
                        <h3 className={`font-display mt-1 text-lg font-bold ${'text-fg-primary'}`}>
                          {lessonDisplayTitle(lesson)}
                        </h3>
                        <p className={`mt-1.5 text-sm leading-relaxed ${'text-fg-secondary'}`}>
                          {lesson.description}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-fg-secondary">
                          {doneOf(lesson)} of {lesson.tasks.length} done
                        </p>
                      </div>
                      <div
                        className="flex shrink-0 items-center gap-1.5"
                        title={`Difficulty: ${DIFFICULTY_LABELS[stars]}`}
                      >
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide ${'text-fg-muted'}`}
                        >
                          {DIFFICULTY_LABELS[stars]}
                        </span>
                        <span className="flex gap-0.5">
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className={`h-1.5 w-1.5 rounded-full ${n <= stars ? 'bg-fg-muted' : 'bg-border'}`}
                            />
                          ))}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <span className={`text-xs ${'text-fg-muted'}`}>
                        {lesson.tasks.length} tasks
                      </span>
                      {isLocked ? (
                        <span className="ml-auto rounded-full bg-muted px-5 py-2 text-sm font-semibold text-fg-muted">
                          {classOnly ? 'Not open yet' : 'Beat the last boss first'}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleStart(lesson)}
                          disabled={loadingId !== null}
                          className={`ml-auto ${isStarted ? 'btn-outline' : 'btn-primary'}`}
                        >
                          {loadingId === lesson.id
                            ? 'Starting...'
                            : isDone
                              ? 'Review →'
                              : isStarted
                                ? 'Resume →'
                                : 'Start'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">{stats && <PlayerCard stats={stats} />}</div>
      </div>
    </AppShell>
  )
}
