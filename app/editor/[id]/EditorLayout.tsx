'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Editor from '@/components/Editor'
import Preview from '@/components/Preview'
import FileTree from '@/components/FileTree'
import type { Project } from '@/types'

interface Props {
  project: Project
}

export default function EditorLayout({ project }: Props) {
  const [code, setCode] = useState<string>(project.files['index.html'] ?? '')
  const [title, setTitle] = useState(project.title)
  const [savingTitle, setSavingTitle] = useState(false)
  const router = useRouter()

  async function handleTitleBlur() {
    if (title === project.title) return
    setSavingTitle(true)
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, title }),
    })
    setSavingTitle(false)
  }

  const currentFiles = code ? { 'index.html': code } : project.files

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors text-sm shrink-0"
          >
            ← Dashboard
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="min-w-0 bg-transparent text-sm font-medium text-white focus:outline-none border-b border-transparent focus:border-gray-600 truncate"
          />
          {savingTitle && (
            <span className="text-xs text-gray-500 shrink-0">Saving...</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {project.is_public && (
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${project.id}`)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Copy share link
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex w-52 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Files</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <FileTree files={currentFiles} />
          </div>
        </aside>

        {/* Editor panel */}
        <div className="flex w-80 shrink-0 flex-col border-r border-gray-800">
          <div className="border-b border-gray-800 px-3 py-2 bg-gray-900">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Prompt</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              projectId={project.id}
              currentCode={code}
              onCodeUpdate={setCode}
            />
          </div>
        </div>

        {/* Preview panel */}
        <div className="flex flex-1 flex-col">
          <div className="border-b border-gray-800 px-3 py-2 bg-gray-900">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Preview</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <Preview code={code} />
          </div>
        </div>
      </div>
    </div>
  )
}
