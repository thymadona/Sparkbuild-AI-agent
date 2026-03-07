'use client'

import { useState } from 'react'
import type { ProjectFiles } from '@/types'

interface FileTreeProps {
  files: ProjectFiles
  activeFile?: string
  onFileClick?: (filename: string) => void
  onAddFile: (filename: string) => void
}

export default function FileTree({ files, activeFile, onFileClick, onAddFile }: FileTreeProps) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'html' | 'css' | 'js'>('js')

  const fileNames = Object.keys(files)

  function handleConfirmAdd() {
    const base = newName.trim()
    if (!base) return
    const filename = base.includes('.') ? base : `${base}.${newType}`
    if (files[filename]) return
    onAddFile(filename)
    setAdding(false)
    setNewName('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleConfirmAdd()
    if (e.key === 'Escape') {
      setAdding(false)
      setNewName('')
    }
  }

  return (
    <div className="px-2 py-1">
      {/* Header with add button */}
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Files</span>
        <button
          onClick={() => setAdding(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors text-base leading-none"
          title="Add file"
        >
          +
        </button>
      </div>

      {fileNames.length === 0 && !adding && (
        <div className="px-2 py-1 text-xs text-gray-500">No files yet.</div>
      )}

      {fileNames.map((name) => (
        <button
          key={name}
          onClick={() => onFileClick?.(name)}
          className={`flex w-full items-center gap-2 rounded px-2 py-1 text-sm transition-colors ${
            activeFile === name
              ? 'bg-gray-800 text-white'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <svg
            className="h-3.5 w-3.5 shrink-0 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="truncate">{name}</span>
        </button>
      ))}

      {adding && (
        <div className="flex items-center gap-1 px-2 py-1 mt-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="filename"
            className="w-24 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none border border-gray-700 focus:border-indigo-500"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'html' | 'css' | 'js')}
            className="rounded bg-gray-800 px-1 py-0.5 text-xs text-gray-300 border border-gray-700 focus:outline-none"
          >
            <option value="html">.html</option>
            <option value="css">.css</option>
            <option value="js">.js</option>
          </select>
          <button
            onClick={handleConfirmAdd}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
