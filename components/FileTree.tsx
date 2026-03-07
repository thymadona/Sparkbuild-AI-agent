'use client'

import type { ProjectFiles } from '@/types'

interface FileTreeProps {
  files: ProjectFiles
  onFileClick?: (filename: string) => void
}

export default function FileTree({ files, onFileClick }: FileTreeProps) {
  const fileNames = Object.keys(files)

  if (fileNames.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500">No files yet.</div>
    )
  }

  return (
    <div className="px-2 py-1">
      {fileNames.map((name) => (
        <button
          key={name}
          onClick={() => onFileClick?.(name)}
          className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
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
    </div>
  )
}
