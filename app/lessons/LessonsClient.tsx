'use client'

import { CURRENT_LESSON_VERSION, Lesson } from '@/lib/lessons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Check, Compass, Lock } from 'lucide-react'
import Navbar from '@/components/Navbar'
import AppSidebar from '@/components/AppSidebar'

// Fixed dark text for chips whose fill (teal-400) stays bright in both
// themes — fg-primary would flip to near-white in dark mode and vanish.
const ON_CHIP = 'text-slate-900'

// bg-secondary's dark-mode CSS var (#ffb1c5) is a pale pastel meant for
// small accents, not a big card fill — on the dark surface it washes out.
// Override with a deeper rose for the "current lesson" card/node/button.
const ACCENT_BG = 'bg-secondary dark:bg-[#b3305f]'
const ACCENT_TEXT = 'text-secondary dark:text-[#b3305f]'

interface Props {
  lessons: Lesson[]
  userProjects: { id: string; lesson_id: number | null; updated_at: string }[]
  enabledLessonIds?: number[]
  userEmail?: string
}

export default function LessonsClient({ lessons, userProjects, enabledLessonIds = [], userEmail = '' }: Props) {
  const enabledSet = new Set(enabledLessonIds)
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Projects arrive newest first, so the first project for each lesson is the resume target.
  const projectByLessonId = new Map<number, string>()
  for (const project of userProjects) {
    if (project.lesson_id !== null && !projectByLessonId.has(project.lesson_id)) {
      projectByLessonId.set(project.lesson_id, project.id)
    }
  }
  const lessonsStarted = projectByLessonId.size
  const difficulty = [1, 1, 2, 2, 3, 3]

  async function handleStart(lesson: Lesson) {
    const existingProjectId = projectByLessonId.get(lesson.id)
    if (existingProjectId) {
      router.push(`/editor/${existingProjectId}`)
      return
    }

    setLoadingId(lesson.id)
    setError(null)
    try {
      const templateRes = await fetch(`/templates/${lesson.templateFile}`)
      const templateHtml = await templateRes.text()

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lesson.title,
          templateHtml,
          lessonId: lesson.id,
          lessonVersion: CURRENT_LESSON_VERSION,
        }),
      })
      if (!res.ok) throw new Error('Failed to create project')
      const data = await res.json()
      router.push(`/editor/${data.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoadingId(null)
    }
  }

  const progressPct = Math.round((lessonsStarted / 6) * 100)

  return (
    <div className="flex min-h-screen bg-surface-900 font-body">
      <AppSidebar userEmail={userEmail} />

      <div className="min-w-0 flex-1">
        <Navbar variant="app" withSidebar pageTitle="Roadmap" userEmail={userEmail} />

        <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-800 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
              6-week track
            </span>
            <h1 className="mt-4 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg">
              Your Journey
            </h1>
            <p className="mt-2 text-body-md text-fg-secondary">6 projects, each one harder than the last.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border-2 border-surface-600 bg-brand-500 px-5 py-3 text-white shadow-hard">
            <Compass className="h-6 w-6" />
            <div>
              <p className="font-display text-lg font-extrabold leading-none">{progressPct}%</p>
              <p className="mt-1 text-xs font-semibold text-white/80">{lessonsStarted}/6 started</p>
            </div>
          </div>
        </div>

        {/* Global progress bar */}
        <div className="mt-8 mb-10 rounded-full border-2 border-surface-600 bg-surface-800 p-1 shadow-hard-sm">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-600 dark:text-red-400 shadow-hard-sm">{error}</div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Roadmap */}
          <div className="relative">
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-surface-600" />
            <div className="space-y-5">
              {lessons.map((lesson, i) => {
                const isStarted = projectByLessonId.has(lesson.id)
                const isLocked = !isStarted && !enabledSet.has(lesson.id)
                const stars = difficulty[i]
                return (
                  <div key={lesson.id} className="flex gap-5 relative">
                    {/* Node */}
                    <div className={`relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-surface-600 text-lg font-bold shadow-hard-sm transition-colors ${
                      isStarted
                        ? `${ACCENT_BG} text-white`
                        : isLocked
                        ? 'bg-surface-800 text-fg-muted'
                        : 'bg-brand-500 text-white'
                    }`}>
                      {isStarted ? <Check className="h-6 w-6" /> : isLocked ? <Lock className="h-5 w-5" /> : String(i + 1)}
                    </div>
                    {/* Card */}
                    <div className={`flex-1 rounded-xl border-2 border-surface-600 p-5 shadow-hard transition-transform ${
                      isStarted ? `${ACCENT_BG} text-white` : 'bg-surface-800'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-xs font-bold uppercase tracking-widest ${isStarted ? 'text-white/80' : 'text-fg-muted'}`}>Week {lesson.id}</p>
                          <h3 className={`font-display mt-1 text-lg font-bold ${isStarted ? 'text-white' : 'text-fg-primary'}`}>
                            {lesson.title.split('—')[1]?.trim() ?? lesson.title}
                          </h3>
                          <p className={`mt-1.5 text-sm leading-relaxed ${isStarted ? 'text-white/85' : 'text-fg-secondary'}`}>{lesson.description}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          {[1, 2, 3].map(n => (
                            <span key={n} className={`text-sm ${n <= stars ? (isStarted ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400') : 'opacity-30 ' + (isStarted ? 'text-white' : 'text-fg-muted')}`}>★</span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <span className={`text-xs ${isStarted ? 'text-white/70' : 'text-fg-muted'}`}>{lesson.tasks.length} tasks</span>
                        {isLocked ? (
                          <span className="ml-auto rounded-lg border-2 border-surface-600 bg-surface-700 px-5 py-2 text-sm font-semibold text-fg-muted">
                            Not open yet
                          </span>
                        ) : (
                          <button
                            onClick={() => handleStart(lesson)}
                            disabled={loadingId !== null}
                            className={`ml-auto rounded-lg border-2 border-surface-600 px-5 py-2 font-display text-sm font-bold shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 ${
                              isStarted
                                ? `bg-white ${ACCENT_TEXT}`
                                : 'bg-brand-500 text-white'
                            }`}
                          >
                            {loadingId === lesson.id ? 'Starting...' : isStarted ? 'Resume →' : 'Start'}
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
          <div className="space-y-5">
            <div className={`rounded-xl border-2 border-surface-600 bg-teal-400 p-5 shadow-hard ${ON_CHIP}`}>
              <h3 className="font-display text-base font-bold">Need inspiration?</h3>
              <p className="mt-2 text-sm">Browse what other students built and remix an idea for your own project.</p>
              <Link
                href="/explore"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-surface-600 bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                Browse Explore →
              </Link>
            </div>
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}
