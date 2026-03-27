'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

interface Project {
  id: string
  title: string
  lesson_id: number | null
  created_at: string
  user_id: string
  files: Record<string, string> | null
}

interface Props {
  projects: Project[]
  isLoggedIn: boolean
}

const gradients: Record<number, string> = {
  1: 'from-violet-600 to-fuchsia-600',
  2: 'from-blue-600 to-cyan-500',
  3: 'from-amber-500 to-orange-600',
  4: 'from-red-600 to-pink-500',
  5: 'from-emerald-500 to-teal-600',
  6: 'from-brand-500 to-indigo-600',
}

const lessonLabels: Record<number, string> = {
  1: 'Week 1 — Personal Page',
  2: 'Week 2 — Make It React',
  3: 'Week 3 — Keep Score',
  4: 'Week 4 — Make It Hard',
  5: 'Week 5 — Add the AI',
  6: 'Week 6 — Real Problem',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function ExploreClient({ projects, isLoggedIn }: Props) {
  const [filter, setFilter] = useState<number | null>(null)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')

  const filtered = projects
    .filter(p => filter === null || p.lesson_id === filter)
    .sort((a, b) => sort === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant={isLoggedIn ? 'app' : 'marketing'} />

      <main className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold text-fg-primary">Student Gallery</h1>
          <p className="mt-2 text-fg-secondary">See what your classmates are building.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === null ? 'bg-brand-500 text-white' : 'border border-surface-600 text-fg-secondary hover:border-brand-400 hover:text-fg-primary'
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4, 5, 6].map(id => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === id ? 'bg-brand-500 text-white' : 'border border-surface-600 text-fg-secondary hover:border-brand-400 hover:text-fg-primary'
              }`}
            >
              Week {id}
            </button>
          ))}
        </div>

        <div className="flex justify-end mb-6">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as 'newest' | 'oldest')}
            className="rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-fg-primary focus:outline-none focus:border-brand-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-6xl mb-4">🏗️</p>
            <p className="font-display text-xl font-semibold text-fg-primary">Nothing here yet</p>
            <p className="mt-2 text-fg-muted">Be the first to share a project.</p>
            <a href="/dashboard" className="mt-6 inline-block rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
              Go build something
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <a
                key={project.id}
                href={`/share/${project.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl overflow-hidden border border-surface-600 bg-surface-800 hover:border-brand-500/50 transition-colors block"
              >
                <div className="relative h-44 overflow-hidden bg-surface-700">
                  {project.files?.['index.html'] ? (
                    <iframe
                      srcDoc={project.files['index.html']}
                      sandbox="allow-scripts"
                      title={`Preview of ${project.title}`}
                      style={{
                        width: '800px',
                        height: '500px',
                        transform: 'scale(0.38)',
                        transformOrigin: 'top left',
                        pointerEvents: 'none',
                        border: 'none',
                      }}
                    />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${gradients[project.lesson_id ?? 0] ?? 'from-gray-400 to-gray-500'}`} />
                  )}
                  {project.lesson_id && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
                      {lessonLabels[project.lesson_id] ?? `Week ${project.lesson_id}`}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-fg-primary truncate group-hover:text-brand-400 transition-colors">{project.title}</p>
                  <p className="text-xs text-fg-muted mt-0.5">{timeAgo(project.created_at)}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
