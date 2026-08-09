'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Sparkles, Shuffle } from 'lucide-react'
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
  userEmail?: string
}

// Fixed dark text for chips whose fill stays bright in both themes —
// fg-primary would flip to near-white in dark mode and vanish against them.
const ON_CHIP = 'text-slate-900'

const WEEK_CHIPS = ['bg-teal-400', 'bg-amber-300', 'bg-secondary', 'bg-teal-400', 'bg-amber-300', 'bg-secondary']
const CARD_HEIGHTS = ['h-40', 'h-56', 'h-48', 'h-64', 'h-36', 'h-52']

const gradients: Record<number, string> = {
  1: 'from-brand-500 to-brand-700',
  2: 'from-teal-500 to-brand-500',
  3: 'from-secondary to-brand-600',
  4: 'from-amber-500 to-secondary',
  5: 'from-brand-600 to-teal-500',
  6: 'from-secondary to-amber-500',
}

const lessonLabels: Record<number, string> = {
  1: 'Week 1 — Profile Pop',
  2: 'Week 2 — Vibe Mixer',
  3: 'Week 3 — Streak Spark',
  4: 'Week 4 — Reflex Rush',
  5: 'Week 5 — Inspiration Lab',
  6: 'Week 6 — Bright Idea',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function ExploreClient({ projects, isLoggedIn, userEmail }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<number | null>(null)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [query, setQuery] = useState('')
  const [remixingId, setRemixingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = projects
    .filter(p => filter === null || p.lesson_id === filter)
    .filter(p => p.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  async function handleRemix(id: string) {
    if (!isLoggedIn) {
      router.push(`/login?next=/explore`)
      return
    }
    setRemixingId(id)
    const res = await fetch('/api/projects/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const copy = await res.json()
    setRemixingId(null)
    if (copy.id) router.push(`/editor/${copy.id}`)
  }

  async function handleNewProject() {
    setCreating(true)
    const res = await fetch('/api/projects', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } })
    const project = await res.json()
    setCreating(false)
    if (project.id) router.push(`/editor/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant={isLoggedIn ? 'app' : 'marketing'} isLoggedIn={isLoggedIn} userEmail={userEmail} />

      {/* Logged-in nav is sticky/in-flow, not the floating marketing header — needs far less top clearance. */}
      <main className={`mx-auto max-w-6xl px-6 pb-24 ${isLoggedIn ? 'pt-12' : 'pt-24'}`}>
        <div className="mb-10">
          <span className="inline-block rounded-full border-2 border-surface-600 bg-surface-800 px-4 py-1.5 text-label-caps uppercase text-fg-secondary">
            Community
          </span>
          <h1 className="mt-4 font-display text-headline-lg-mobile text-fg-primary sm:text-headline-lg">
            Student Gallery
          </h1>
          <p className="mt-2 text-body-md text-fg-secondary">See what your classmates are building.</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded-lg border-2 border-surface-600 bg-surface-800 py-2.5 pl-11 pr-4 text-sm text-fg-primary shadow-hard-sm placeholder:text-fg-muted focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter(null)}
              className={`rounded-full border-2 border-surface-600 px-4 py-1.5 text-sm font-bold transition-all ${
                filter === null ? 'bg-brand-500 text-white shadow-hard-sm' : 'bg-surface-800 text-fg-secondary hover:text-fg-primary'
              }`}
            >
              All
            </button>
            {[1, 2, 3, 4, 5, 6].map(id => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-full border-2 border-surface-600 px-4 py-1.5 text-sm font-bold transition-all ${
                  filter === id ? 'bg-brand-500 text-white shadow-hard-sm' : 'bg-surface-800 text-fg-secondary hover:text-fg-primary'
                }`}
              >
                Week {id}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as 'newest' | 'oldest')}
            className="rounded-lg border-2 border-surface-600 bg-surface-800 px-3 py-1.5 text-sm font-semibold text-fg-primary shadow-hard-sm focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Feed */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-surface-600 py-24 text-center">
              <p className="text-6xl mb-4">🏗️</p>
              <p className="font-display text-xl font-semibold text-fg-primary">Nothing here yet</p>
              <p className="mt-2 text-fg-muted">Be the first to share a project.</p>
              <Link href="/dashboard" className="mt-6 inline-block rounded-lg border-2 border-surface-600 bg-brand-500 px-6 py-2.5 font-display text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                Go build something
              </Link>
            </div>
          ) : (
            <div className="columns-1 gap-5 sm:columns-2 xl:columns-3">
              {filtered.map((project, i) => (
                <div
                  key={project.id}
                  className="mb-5 break-inside-avoid overflow-hidden rounded-xl border-2 border-surface-600 bg-surface-800 shadow-hard"
                >
                  <a href={`/share/${project.id}`} target="_blank" rel="noopener noreferrer" className="group block">
                    <div className={`relative ${CARD_HEIGHTS[i % CARD_HEIGHTS.length]} overflow-hidden border-b-2 border-surface-600 bg-surface-700`}>
                      {project.files?.['index.html'] ? (
                        <iframe
                          srcDoc={project.files['index.html']}
                          sandbox="allow-scripts"
                          title={`Preview of ${project.title}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '800px',
                            height: '500px',
                            transform: 'scale(0.38)',
                            transformOrigin: 'top left',
                            pointerEvents: 'none',
                            border: 'none',
                          }}
                        />
                      ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${gradients[project.lesson_id ?? 0] ?? 'from-brand-500 to-brand-700'}`} />
                      )}
                      {project.lesson_id && (
                        <span className={`absolute bottom-2 right-2 rounded-full border-2 border-surface-600 px-2 py-0.5 text-xs font-bold ${WEEK_CHIPS[(project.lesson_id - 1) % WEEK_CHIPS.length]} ${ON_CHIP}`}>
                          {lessonLabels[project.lesson_id] ?? `Week ${project.lesson_id}`}
                        </span>
                      )}
                    </div>
                    <div className="p-4 pb-2">
                      <p className="font-display font-bold text-fg-primary truncate group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">{project.title}</p>
                      <p className="text-xs text-fg-muted mt-0.5">{timeAgo(project.created_at)}</p>
                    </div>
                  </a>
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => handleRemix(project.id)}
                      disabled={remixingId === project.id}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-surface-600 bg-secondary px-4 py-2 text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 dark:bg-[#b3305f]"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      {remixingId === project.id ? 'Remixing…' : 'Remix'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sidebar */}
          <div className="space-y-5">
            <div className={`rounded-xl border-2 border-surface-600 bg-teal-400 p-5 shadow-hard ${ON_CHIP}`}>
              <Sparkles className="h-6 w-6" />
              <h3 className="mt-3 font-display text-base font-bold">Got an idea?</h3>
              <p className="mt-2 text-sm">Start an empty project and show the class what you can build.</p>
              {isLoggedIn ? (
                <button
                  onClick={handleNewProject}
                  disabled={creating}
                  className="mt-4 w-full rounded-lg border-2 border-surface-600 bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'New project'}
                </button>
              ) : (
                <Link
                  href="/register"
                  className="mt-4 block w-full rounded-lg border-2 border-surface-600 bg-slate-900 px-4 py-2 text-center text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  Sign up free
                </Link>
              )}
            </div>
            <div className="rounded-xl border-2 border-surface-600 bg-surface-800 p-5 shadow-hard-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-fg-muted">Showing</p>
              <p className="mt-1 font-display text-2xl font-bold text-fg-primary">{projects.length} public builds</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
