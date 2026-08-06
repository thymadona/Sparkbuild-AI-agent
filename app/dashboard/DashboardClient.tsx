'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Globe, ArrowRight } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import ProfileDropdown from '@/components/ProfileDropdown'
import { LESSONS } from '@/lib/lessons'

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
}

export default function DashboardClient({ initialProjects, userEmail }: Props) {
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const router = useRouter()
  const firstName = userEmail.split('@')[0] || 'there'
  const lessonsStarted = new Set(projects.filter(p => p.lesson_id).map(p => p.lesson_id)).size
  const publicCount = projects.filter(p => p.is_public).length

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
    <div className="min-h-screen bg-surface-900 font-body">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-surface-600/50 bg-surface-900/90 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <a href="/" className="font-display text-lg font-bold text-fg-primary">
          <span className="text-brand-600 dark:text-brand-400">Code</span>Builder
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/lessons" className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block">Lessons</a>
          <a href="/explore" className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block">Explore</a>
          <ThemeToggle />
          <ProfileDropdown email={userEmail} />
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Welcome banner */}
        <section className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-fg-muted mb-1">Welcome back</p>
            <h1 className="font-display text-2xl font-bold text-fg-primary">Hey, {firstName}. What are you building today?</h1>
          </div>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2.5} />
            {creating ? 'Creating…' : 'New project'}
          </button>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { value: projects.length, label: 'Projects' },
            { value: `${lessonsStarted}/6`, label: 'Lessons started' },
            { value: publicCount, label: 'Shared publicly' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-lg bg-surface-700 p-4">
              <p className="text-xs text-fg-secondary mb-1.5">{label}</p>
              <p className="font-display text-2xl font-bold text-fg-primary">{value}</p>
            </div>
          ))}
        </section>

        {/* Lesson progress */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-fg-primary">Your journey</h2>
            <a href="/lessons" className="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
              See all <ArrowRight size={14} />
            </a>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {LESSONS.map((lesson) => {
              const started = projects.some(p => p.lesson_id === lesson.id)
              return (
                <div
                  key={lesson.id}
                  className={`shrink-0 flex items-center gap-2 rounded-full pl-2 pr-3.5 py-2 ${
                    started ? 'bg-brand-100 dark:bg-brand-500/10' : 'bg-surface-700'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                      started ? 'bg-brand-500 text-white' : 'border border-surface-600 text-fg-muted'
                    }`}
                  >
                    {started ? <Check size={12} strokeWidth={3} /> : lesson.id}
                  </span>
                  <span className={`text-xs font-semibold whitespace-nowrap ${started ? 'text-brand-700 dark:text-brand-300' : 'text-fg-secondary'}`}>
                    Week {lesson.id}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Projects */}
        <section>
          <h2 className="font-display text-base font-semibold text-fg-primary mb-4">
            My Projects
            <span className="ml-2 text-sm font-normal text-fg-muted">({projects.length})</span>
          </h2>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-600 py-20 text-center">
              <p className="text-5xl mb-4">🚀</p>
              <p className="font-display text-xl font-semibold text-fg-primary">Nothing here yet!</p>
              <p className="text-sm text-fg-muted mt-2 mb-6">Start a lesson or create a blank project.</p>
              <div className="flex gap-3 justify-center">
                <a href="/lessons" className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
                  Start a lesson
                </a>
                <button onClick={handleNewProject} disabled={creating} className="rounded-xl border border-surface-600 px-5 py-2.5 text-sm text-fg-secondary hover:border-brand-400 transition-colors disabled:opacity-50">
                  Blank project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-xl border border-surface-600 bg-surface-800 p-4 transition-colors dark:hover:border-surface-700">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 dark:bg-brand-500/10 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                        {project.lesson_id ?? <Globe size={12} />}
                      </span>
                      <span className="text-xs text-fg-muted">
                        Updated {new Date(project.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    {project.is_public && (
                      <span className="rounded-md bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-400">Public</span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-fg-primary truncate mb-0.5">{project.title}</p>
                  <p className="text-xs text-fg-muted mb-3.5">
                    {project.lesson_id ? `Week ${project.lesson_id}` : 'Free build'}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs">
                    <a
                      href={`/editor/${project.id}`}
                      className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600 transition-colors"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => handleTogglePublic(project)}
                      className="rounded-lg bg-surface-700 px-3 py-1.5 text-fg-secondary hover:text-fg-primary transition-colors"
                    >
                      {project.is_public ? 'Unshare' : 'Share'}
                    </button>
                    <button
                      onClick={() => handleDuplicate(project)}
                      disabled={duplicating === project.id}
                      className="rounded-lg bg-surface-700 px-3 py-1.5 text-fg-secondary hover:text-fg-primary transition-colors disabled:opacity-50"
                    >
                      {duplicating === project.id ? '…' : 'Copy'}
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="ml-auto rounded-lg bg-surface-700 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  {project.is_public && (
                    <button
                      onClick={() => handleCopyLink(project.id)}
                      className="mt-2.5 w-full rounded-lg bg-surface-700 py-1.5 text-xs text-fg-secondary hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
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
  )
}
