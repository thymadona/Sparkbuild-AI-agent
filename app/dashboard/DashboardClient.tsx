'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Lock, Sparkles,
  User, Palette, Flame, Zap, Lightbulb, Rocket,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { LESSONS } from '@/lib/lessons'
import PlayerCard from '@/components/PlayerCard'
import type { PlayerStats } from '@/lib/xp'

const MODULE_ICONS = [User, Palette, Flame, Zap, Lightbulb, Rocket]
const MODULE_CHIPS = ['bg-tint-sage', 'bg-tint-sand', 'bg-tint-mint', 'bg-tint-blush', 'bg-tint-sage', 'bg-tint-sand'] as const

// Dashboard only ever renders these fields — the full Project type also
// includes `files`, which would be a wasted fetch for a list view.
type ProjectListItem = {
  id: string
  title: string
  lesson_id: number | null
  updated_at: string
}

interface Props {
  initialProjects: ProjectListItem[]
  userEmail: string
  enabledLessonIds?: number[]
  stats: PlayerStats
}

export default function DashboardClient({ initialProjects, userEmail, enabledLessonIds = [], stats }: Props) {
  const enabledSet = new Set(enabledLessonIds)
  const [projects, setProjects] = useState(initialProjects)
  const firstName = userEmail.split('@')[0] || 'there'
  // Only count lessons in the current course; older projects belong to a retired catalog.
  const lessonsStarted = new Set(projects.filter(p => LESSONS.some(l => l.id === p.lesson_id)).map(p => p.lesson_id)).size

  // Projects arrive newest-first from the server, so the first lesson
  // project is the most recently touched one — the natural "pick up where
  // you left off" candidate.
  const inProgressProject = projects.find(p => LESSONS.some(l => l.id === p.lesson_id))
  const inProgressLesson = inProgressProject
    ? LESSONS.find(l => l.id === inProgressProject.lesson_id)
    : undefined

  async function handleDelete(id: string) {
    if (!confirm('Delete this project?')) return
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <AppShell userEmail={userEmail} pageTitle="Home">
      {/* Welcome */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-fg-primary">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-2 text-lg text-fg-secondary">Ready to write some code today?</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {/* Continue learning */}
          {inProgressProject && inProgressLesson && (
            <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-tint-sage p-6 sm:p-8">
              <span className="inline-block rounded-full bg-card/70 px-3 py-1 text-label-caps uppercase text-fg-secondary">
                In progress
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold text-fg-primary">
                {inProgressLesson.title.split('—')[1]?.trim() ?? inProgressLesson.title}
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-fg-secondary">{inProgressLesson.description}</p>
              <Link href={`/board/${inProgressProject.id}`} className="btn-primary mt-6 py-3">
                Continue learning
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Sparkles className="pointer-events-none absolute right-6 top-6 h-10 w-10 text-fg-primary/10" />
            </section>
          )}

          {/* Modules */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-fg-primary">Your modules</h2>
              <Link href="/lessons" className="inline-flex items-center gap-1 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg-primary">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {LESSONS.slice(0, 3).map((lesson, i) => {
                const started = projects.some(p => p.lesson_id === lesson.id)
                const locked = !started && !enabledSet.has(lesson.id)
                const Icon = MODULE_ICONS[i] ?? User
                return (
                  <div key={lesson.id} className={`rounded-2xl border border-border bg-card p-5 ${locked ? 'opacity-60' : ''}`}>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${MODULE_CHIPS[i] ?? 'bg-tint-sage'}`}>
                      {locked ? <Lock className="h-5 w-5 text-fg-primary" /> : <Icon className="h-5 w-5 text-fg-primary" />}
                    </div>
                    <h3 className="mt-4 font-display text-base font-bold text-fg-primary">
                      {lesson.title.split('—')[1]?.trim() ?? lesson.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-fg-secondary">{lesson.description}</p>
                    <div className="mt-4">
                      {locked ? (
                        <span className="inline-block rounded-full bg-muted px-4 py-2 text-sm font-semibold text-fg-muted">Not open yet</span>
                      ) : (
                        <Link href="/lessons" className="btn-outline">{started ? 'Resume' : 'Start'}</Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <PlayerCard stats={stats} />
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            {[
              { value: projects.length, label: 'Projects' },
              { value: `${lessonsStarted}/${LESSONS.length}`, label: 'Lessons started' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-2xl border border-border bg-card px-5 py-4">
                <p className="text-xs text-fg-secondary">{label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-fg-primary">{value}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Projects */}
      <section>
        <h2 className="mb-4 font-display text-xl font-bold text-fg-primary">
          My Projects
          <span className="ml-2 text-sm font-normal text-fg-muted">({projects.length})</span>
        </h2>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="mb-4 text-5xl">🚀</p>
            <p className="font-display text-xl font-semibold text-fg-primary">Nothing here yet!</p>
            <p className="mb-6 mt-2 text-sm text-fg-muted">Start a lesson to make your first project.</p>
            <Link href="/lessons" className="btn-primary">Start a lesson</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const weekIndex = LESSONS.findIndex(l => l.id === project.lesson_id)
              return (
              <div key={project.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tint-sand text-[11px] font-semibold text-fg-primary">
                    {weekIndex >= 0 ? weekIndex + 1 : '·'}
                  </span>
                  <span className="text-xs text-fg-muted">Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                </div>

                <p className="mb-0.5 truncate text-sm font-semibold text-fg-primary">{project.title}</p>
                <p className="mb-4 text-xs text-fg-muted">{weekIndex >= 0 ? `Week ${weekIndex + 1}` : 'Older course'}</p>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Link href={`/board/${project.id}`} className="btn-primary !px-4 !py-1.5 !text-xs">Open</Link>
                  <button onClick={() => handleDelete(project.id)} className="btn-outline ml-auto !px-3 !py-1.5 !text-xs !text-red-600 hover:!bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </section>
    </AppShell>
  )
}
