'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Project } from '@/types'

interface Props {
  initialProjects: Project[]
  userEmail: string
}

export default function DashboardClient({ initialProjects, userEmail }: Props) {
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

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

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">My Projects</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{userEmail}</span>
          <a href="/profile" className="text-sm text-gray-400 hover:text-white transition-colors">
            Profile
          </a>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-400 text-sm">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : '+ New Project'}
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 p-12 text-center">
            <p className="text-gray-500 mb-4">No projects yet.</p>
            <button
              onClick={handleNewProject}
              disabled={creating}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create your first project'}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-gray-800 bg-gray-900 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-white truncate">{project.title}</h2>
                  {project.is_public && (
                    <span className="shrink-0 rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300">
                      Public
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Updated {new Date(project.updated_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => router.push(`/editor/${project.id}`)}
                    className="flex-1 rounded bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleTogglePublic(project)}
                    className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    {project.is_public ? 'Make private' : 'Share'}
                  </button>
                  {project.is_public && (
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${project.id}`)}
                      className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                      title="Copy share link"
                    >
                      Copy link
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(project)}
                    disabled={duplicating === project.id}
                    className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {duplicating === project.id ? '...' : 'Duplicate'}
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="rounded bg-gray-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
