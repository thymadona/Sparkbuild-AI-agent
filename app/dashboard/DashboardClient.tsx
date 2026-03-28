'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import ProfileDropdown from '@/components/ProfileDropdown'
import type { Project } from '@/types'
import { LESSONS } from '@/lib/lessons'

interface Props {
  initialProjects: Project[]
  userEmail: string
}

function getLessonGradient(lessonId: number | null): string {
  const map: Record<number, string> = {
    1: 'from-violet-600 to-fuchsia-600',
    2: 'from-blue-600 to-cyan-500',
    3: 'from-amber-500 to-orange-600',
    4: 'from-red-600 to-pink-500',
    5: 'from-emerald-500 to-teal-600',
    6: 'from-brand-500 to-indigo-600',
  }
  return map[lessonId ?? 0] ?? 'from-gray-400 to-gray-500'
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

  async function handleTogglePublic(project: Project) {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, is_public: !project.is_public }),
    })
    const updated = await res.json()
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  async function handleDuplicate(project: Project) {
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
        <section className="rounded-2xl bg-gradient-to-r from-brand-100 to-surface-900 border border-brand-200 dark:from-brand-600/20 dark:to-surface-800 dark:border-brand-500/20 px-6 py-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Welcome back</p>
            <h1 className="font-display mt-1 text-2xl font-bold text-fg-primary">Hey, {firstName}!</h1>
            <p className="mt-1 text-sm text-fg-secondary">What are you building today?</p>
          </div>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="shrink-0 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition-all disabled:opacity-50"
          >
            {creating ? 'Creating...' : '+ New Project'}
          </button>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-4">
          {[
            { value: projects.length, label: 'Projects', color: 'text-brand-600 dark:text-brand-400' },
            { value: `${lessonsStarted}/6`, label: 'Lessons started', color: 'text-amber-600 dark:text-amber-400' },
            { value: publicCount, label: 'Shared publicly', color: 'text-teal-600 dark:text-teal-400' },
          ].map(({ value, label, color }) => (
            <div key={label} className="rounded-xl border border-surface-600 bg-surface-800 p-4 text-center shadow-sm dark:shadow-none">
              <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-fg-muted mt-1">{label}</p>
            </div>
          ))}
        </section>

        {/* Lesson progress strip */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-fg-primary">Lesson Progress</h2>
            <a href="/lessons" className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">See all →</a>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {LESSONS.map((lesson) => {
              const started = projects.some(p => p.lesson_id === lesson.id)
              return (
                <div key={lesson.id} className={`shrink-0 rounded-xl border px-4 py-3 w-40 transition-colors ${
                  started ? 'border-brand-500/50 bg-brand-500/10' : 'border-surface-600 bg-surface-800'
                }`}>
                  <span className={`text-xs font-bold ${started ? 'text-brand-600 dark:text-brand-400' : 'text-fg-muted'}`}>
                    Week {lesson.id}
                  </span>
                  <p className="mt-1 text-xs text-fg-secondary leading-snug line-clamp-2">
                    {lesson.title.split('—')[1]?.trim() || lesson.title}
                  </p>
                  {started && <span className="mt-2 inline-block text-xs text-teal-600 dark:text-teal-400">Started</span>}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-surface-600 bg-surface-800 overflow-hidden shadow-sm dark:shadow-none hover:border-brand-200 dark:hover:border-surface-700 transition-colors">
                  {/* Gradient top strip */}
                  <div className={`h-2 bg-gradient-to-r ${getLessonGradient(project.lesson_id)}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-fg-primary truncate">{project.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-fg-muted">
                            {project.lesson_id ? `Week ${project.lesson_id}` : 'Free Build'}
                          </span>
                          {project.is_public && (
                            <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-400">Public</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-fg-muted mb-3">
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <a href={`/editor/${project.id}`} className="flex-1 rounded-xl bg-brand-500 py-2 text-center text-xs font-semibold text-white hover:bg-brand-600 transition-colors">
                        Open
                      </a>
                      <button
                        onClick={() => handleTogglePublic(project)}
                        className="rounded-xl border border-surface-600 px-3 py-2 text-xs text-fg-secondary hover:border-brand-400 hover:text-fg-primary transition-colors"
                        title={project.is_public ? 'Make private' : 'Share'}
                      >
                        {project.is_public ? 'Unshare' : 'Share'}
                      </button>
                      <button
                        onClick={() => handleDuplicate(project)}
                        disabled={duplicating === project.id}
                        className="rounded-xl border border-surface-600 px-3 py-2 text-xs text-fg-secondary hover:border-surface-600 transition-colors disabled:opacity-50"
                        title="Duplicate"
                      >
                        {duplicating === project.id ? '...' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="rounded-xl border border-surface-600 px-3 py-2 text-xs text-red-500 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                    {project.is_public && (
                      <button
                        onClick={() => handleCopyLink(project.id)}
                        className="mt-2 w-full rounded-xl border border-surface-600 py-1.5 text-xs text-fg-secondary hover:border-brand-300 hover:text-brand-600 dark:hover:border-brand-400 dark:hover:text-brand-400 transition-colors"
                      >
                        Copy share link
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
