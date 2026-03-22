'use client'

import { Lesson } from '@/lib/lessons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  lessons: Lesson[]
  userProjects: { id: string; lesson_id: number | null }[]
}

export default function LessonsClient({ lessons, userProjects }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startedLessonIds = new Set(userProjects.map(p => p.lesson_id))
  const lessonsStarted = startedLessonIds.size
  const difficulty = [1, 1, 2, 2, 3, 3]

  async function handleStart(lesson: Lesson) {
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

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <header className="sticky top-0 z-10 border-b border-surface-600/50 bg-surface-900/90 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <a href="/dashboard" className="font-display text-lg font-bold text-white">
          <span className="text-brand-400">Code</span>Builder
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          <a href="/explore" className="text-gray-400 hover:text-white transition-colors hidden sm:block">Explore</a>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold text-white">Your Journey</h1>
        <p className="mt-2 text-gray-400">6 projects, each one harder than the last.</p>

        {/* Global progress bar */}
        <div className="mt-6 mb-10">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{lessonsStarted} started</span>
            <span>6 total</span>
          </div>
          <div className="h-2 rounded-full bg-surface-700">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-700"
              style={{ width: `${(lessonsStarted / 6) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* Journey path */}
        <div className="relative">
          <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-surface-600" />
          <div className="space-y-6">
            {lessons.map((lesson, i) => {
              const isStarted = startedLessonIds.has(lesson.id)
              const stars = difficulty[i]
              return (
                <div key={lesson.id} className="flex gap-5 relative">
                  {/* Node */}
                  <div className={`relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold transition-all ${
                    isStarted
                      ? 'border-brand-500 bg-brand-900/60 text-brand-300 shadow-lg shadow-brand-500/20'
                      : 'border-surface-600 bg-surface-800 text-gray-500'
                  }`}>
                    {isStarted ? '✓' : String(i + 1)}
                  </div>
                  {/* Card */}
                  <div className={`flex-1 rounded-2xl border p-5 transition-colors ${
                    isStarted
                      ? 'border-brand-500/30 bg-surface-800'
                      : 'border-surface-600 bg-surface-800 hover:border-surface-500'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Week {lesson.id}</p>
                        <h3 className="font-display mt-1 text-lg font-bold text-white">
                          {lesson.title.split('—')[1]?.trim() ?? lesson.title}
                        </h3>
                        <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">{lesson.description}</p>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3].map(n => (
                          <span key={n} className={n <= stars ? 'text-amber-400 text-sm' : 'text-surface-600 text-sm'}>★</span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-xs text-gray-600">{lesson.tasks.length} tasks</span>
                      <button
                        onClick={() => handleStart(lesson)}
                        disabled={loadingId !== null}
                        className={`ml-auto rounded-xl px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                          isStarted
                            ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
                            : 'bg-brand-500 text-white hover:bg-brand-600 shadow-md shadow-brand-500/20'
                        }`}
                      >
                        {loadingId === lesson.id ? 'Starting...' : isStarted ? 'Start again →' : 'Start'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
