'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Globe, ArrowRight, Lock, Sparkles,
  User, Palette, Flame, Zap, Lightbulb, Rocket,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import AppSidebar from '@/components/AppSidebar'
import { LESSONS } from '@/lib/lessons'

// Fixed dark text for chips whose fill stays bright in both themes —
// fg-primary would flip to near-white in dark mode and vanish against them.
const ON_CHIP = 'text-slate-900'

const MODULE_ICONS = [User, Palette, Flame, Zap, Lightbulb, Rocket]
const MODULE_CHIPS = ['bg-teal-400', 'bg-amber-300', 'bg-secondary', 'bg-teal-400', 'bg-amber-300', 'bg-secondary'] as const

// Dashboard only ever renders these fields — the full Project type also
// includes `files`, which would be a wasted fetch for a list view.
type ProjectListItem = {
  id: string
  title: string
  lesson_id: number | null
  updated_at: string
  is_public: boolean
}

interface Props {
  initialProjects: ProjectListItem[]
  userEmail: string
  enabledLessonIds?: number[]
}

export default function DashboardClient({ initialProjects, userEmail, enabledLessonIds = [] }: Props) {
  const enabledSet = new Set(enabledLessonIds)
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const router = useRouter()
  const firstName = userEmail.split('@')[0] || 'there'
  const lessonsStarted = new Set(projects.filter(p => p.lesson_id).map(p => p.lesson_id)).size
  const publicCount = projects.filter(p => p.is_public).length

  // Projects arrive newest-first from the server, so the first lesson
  // project is the most recently touched one — the natural "pick up where
  // you left off" candidate.
  const inProgressProject = projects.find(p => p.lesson_id !== null)
  const inProgressLesson = inProgressProject
    ? LESSONS.find(l => l.id === inProgressProject.lesson_id)
    : undefined

  async function handleNewProject() {
    setCreating(true)
    const res = await fetch('/api/projects', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } })
    const project = await res.json()
    setCreating(false)
    if (project.id) {
      router.push(`/editor/${project.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project?')) return
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleTogglePublic(project: ProjectListItem) {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, is_public: !project.is_public }),
    })
    const updated = await res.json()
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  async function handleDuplicate(project: ProjectListItem) {
    setDuplicating(project.id)
    const res = await fetch('/api/projects/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id }),
    })
    const copy = await res.json()
    setDuplicating(null)
    if (copy.id) router.push(`/editor/${copy.id}`)
  }

  function handleCopyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/share/${id}`)
  }

  return (
    <div className="flex min-h-screen bg-surface-900 font-body">
      <AppSidebar userEmail={userEmail} />

      <div className="min-w-0 flex-1">
        <Navbar variant="app" withSidebar pageTitle="Dashboard" userEmail={userEmail} />

        <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        {/* Welcome banner */}
        <section className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-800 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
              Mission control
            </span>
            <h1 className="mt-4 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-md">
              Hey, {firstName}. Ready to write some code?
            </h1>
          </div>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border-2 border-surface-600 bg-brand-500 px-4 py-2.5 font-display text-sm font-bold text-white shadow-hard transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2.5} />
            {creating ? 'Creating…' : 'New project'}
          </button>
        </section>

        {/* Continue learning */}
        {inProgressProject && inProgressLesson && (
          <section className="relative overflow-hidden rounded-xl border-2 border-surface-600 bg-surface-800 p-6 shadow-hard-lg sm:p-8">
            <span className="inline-block rounded-full border-2 border-surface-600 bg-teal-400 px-3 py-1 text-label-caps uppercase text-slate-900">
              In progress
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-fg-primary">
              {inProgressLesson.title.split('—')[1]?.trim() ?? inProgressLesson.title}
            </h2>
            <p className="mt-2 max-w-lg text-sm text-fg-secondary leading-relaxed">{inProgressLesson.description}</p>
            <a
              href={`/editor/${inProgressProject.id}`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border-2 border-surface-600 bg-brand-500 px-6 py-3 font-display text-sm font-bold text-white shadow-hard transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Continue learning
              <ArrowRight className="h-4 w-4" />
            </a>
            <Sparkles className="pointer-events-none absolute right-6 top-6 h-8 w-8 text-brand-500/20" />
          </section>
        )}

        {/* Stats */}
        <section className="grid grid-cols-3 gap-4">
          {[
            { value: projects.length, label: 'Projects' },
            { value: `${lessonsStarted}/6`, label: 'Lessons started' },
            { value: publicCount, label: 'Shared publicly' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-xl border-2 border-surface-600 bg-surface-800 p-4 shadow-hard-sm">
              <p className="text-xs text-fg-secondary mb-1.5">{label}</p>
              <p className="font-display text-2xl font-bold text-fg-primary">{value}</p>
            </div>
          ))}
        </section>

        {/* Modules */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-fg-primary">Your modules</h2>
            <Link href="/lessons" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LESSONS.slice(0, 3).map((lesson, i) => {
              const started = projects.some(p => p.lesson_id === lesson.id)
              const locked = !started && !enabledSet.has(lesson.id)
              const Icon = MODULE_ICONS[i] ?? User
              return (
                <div key={lesson.id} className={`rounded-xl border-2 border-surface-600 bg-surface-800 p-5 shadow-hard ${locked ? 'opacity-60' : ''}`}>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-surface-600 ${MODULE_CHIPS[i] ?? 'bg-teal-400'}`}>
                    {locked ? <Lock className={`h-5 w-5 ${ON_CHIP}`} /> : <Icon className={`h-5 w-5 ${ON_CHIP}`} />}
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-fg-primary">
                    {lesson.title.split('—')[1]?.trim() ?? lesson.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-fg-secondary leading-relaxed line-clamp-2">{lesson.description}</p>
                  <div className="mt-4">
                    {locked ? (
                      <span className="inline-block rounded-lg border-2 border-surface-600 bg-surface-700 px-4 py-2 text-sm font-semibold text-fg-muted">
                        Not open yet
                      </span>
                    ) : (
                      <Link
                        href="/lessons"
                        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-surface-600 bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                      >
                        {started ? 'Resume' : 'Start'}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Projects */}
        <section>
          <h2 className="font-display text-lg font-bold text-fg-primary mb-4">
            My Projects
            <span className="ml-2 text-sm font-normal text-fg-muted">({projects.length})</span>
          </h2>

          {projects.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-surface-600 py-20 text-center">
              <p className="text-5xl mb-4">🚀</p>
              <p className="font-display text-xl font-semibold text-fg-primary">Nothing here yet!</p>
              <p className="text-sm text-fg-muted mt-2 mb-6">Start a lesson or create a blank project.</p>
              <div className="flex gap-3 justify-center">
                <Link href="/lessons" className="rounded-lg border-2 border-surface-600 bg-brand-500 px-5 py-2.5 font-display text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                  Start a lesson
                </Link>
                <button onClick={handleNewProject} disabled={creating} className="rounded-lg border-2 border-surface-600 bg-surface-800 px-5 py-2.5 font-display text-sm font-bold text-fg-secondary shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50">
                  Blank project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-xl border-2 border-surface-600 bg-surface-800 p-4 shadow-hard">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-surface-600 bg-brand-100 dark:bg-brand-500/10 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                        {project.lesson_id ?? <Globe size={12} />}
                      </span>
                      <span className="text-xs text-fg-muted">
                        Updated {new Date(project.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    {project.is_public && (
                      <span className="rounded-md border-2 border-surface-600 bg-teal-400 px-2 py-0.5 text-xs font-bold text-slate-900">Public</span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-fg-primary truncate mb-0.5">{project.title}</p>
                  <p className="text-xs text-fg-muted mb-3.5">
                    {project.lesson_id ? `Week ${project.lesson_id}` : 'Free build'}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs">
                    <a
                      href={`/editor/${project.id}`}
                      className="rounded-lg border-2 border-surface-600 bg-brand-500 px-3 py-1.5 font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => handleTogglePublic(project)}
                      className="rounded-lg border-2 border-surface-600 bg-surface-700 px-3 py-1.5 text-fg-secondary hover:text-fg-primary transition-colors"
                    >
                      {project.is_public ? 'Unshare' : 'Share'}
                    </button>
                    <button
                      onClick={() => handleDuplicate(project)}
                      disabled={duplicating === project.id}
                      className="rounded-lg border-2 border-surface-600 bg-surface-700 px-3 py-1.5 text-fg-secondary hover:text-fg-primary transition-colors disabled:opacity-50"
                    >
                      {duplicating === project.id ? '…' : 'Copy'}
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="ml-auto rounded-lg border-2 border-surface-600 bg-surface-700 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  {project.is_public && (
                    <button
                      onClick={() => handleCopyLink(project.id)}
                      className="mt-2.5 w-full rounded-lg border-2 border-surface-600 bg-surface-700 py-1.5 text-xs text-fg-secondary hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      Copy share link
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        </main>
      </div>
    </div>
  )
}
