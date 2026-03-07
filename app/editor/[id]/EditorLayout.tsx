'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Editor from '@/components/Editor'
import Preview from '@/components/Preview'
import FileTree from '@/components/FileTree'
import CodeEditor from '@/components/CodeEditor'
import type { Project, Message } from '@/types'

interface Props {
  project: Project
  initialMessages: Message[]
}

type RightTab = 'code' | 'preview'
type Activity = 'explorer' | 'chat'

export default function EditorLayout({ project, initialMessages }: Props) {
  const [code, setCode] = useState<string>(project.files['index.html'] ?? '')
  const [title, setTitle] = useState(project.title)
  const [savingTitle, setSavingTitle] = useState(false)
  const [rightTab, setRightTab] = useState<RightTab>('preview')
  const [activity, setActivity] = useState<Activity>('chat')
  const [sideOpen, setSideOpen] = useState(true)
  const [sideWidth, setSideWidth] = useState(240)
  const [previewBlocked, setPreviewBlocked] = useState(false)
  const [selectedCode, setSelectedCode] = useState<{ text: string; startLine: number; endLine: number } | null>(null)
  const sideWidthRef = useRef(240)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const isDraggingRef = useRef(false)
  const router = useRouter()

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = sideWidthRef.current
    isDraggingRef.current = true
    setPreviewBlocked(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current
      const max = Math.floor(window.innerWidth / 2)
      const next = Math.max(160, Math.min(max, dragStartWidth.current + delta))
      sideWidthRef.current = next
      setSideWidth(next)
    }
    const onUp = () => {
      isDraggingRef.current = false
      setPreviewBlocked(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

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

  async function handleCodeSave(newCode: string) {
    setCode(newCode)
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, files: { 'index.html': newCode } }),
    })
  }

  function handleFileClick(filename: string) {
    if (filename === 'index.html') {
      setRightTab('code')
    }
  }

  function handleActivity(clicked: Activity) {
    if (clicked === activity) {
      setSideOpen((o) => !o)
    } else {
      setActivity(clicked)
      setSideOpen(true)
    }
  }

  const currentFiles = code ? { 'index.html': code } : project.files

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Top bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-white transition-colors text-sm shrink-0"
          >
            &larr;
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="min-w-0 bg-transparent text-sm font-medium text-white focus:outline-none border-b border-transparent focus:border-gray-600 truncate"
          />
          {savingTitle && <span className="text-xs text-gray-500 shrink-0">Saving...</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {project.is_public && (
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${project.id}`)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Copy link
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Activity bar */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gray-800 bg-[#1e1e2e] py-2">
          {/* Explorer icon */}
          <button
            onClick={() => handleActivity('explorer')}
            className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
              activity === 'explorer' && sideOpen
                ? 'border-l-2 border-indigo-500 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Explorer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </button>

          {/* Chat icon */}
          <button
            onClick={() => handleActivity('chat')}
            className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
              activity === 'chat' && sideOpen
                ? 'border-l-2 border-indigo-500 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Chat"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>

        {/* Side panel */}
        <div
          className={`flex flex-col border-r border-gray-800 bg-gray-900 overflow-hidden shrink-0 ${previewBlocked ? '' : 'transition-[width] duration-200'}`}
          style={{ width: sideOpen ? sideWidth : 0 }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-500">
              {activity === 'explorer' ? 'Explorer' : 'Chat'}
            </span>
            <button
              onClick={() => setSideOpen(false)}
              className="text-gray-600 hover:text-gray-400 transition-colors text-base leading-none"
              title="Close panel"
            >
              &times;
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {activity === 'explorer' ? (
              <FileTree files={currentFiles} onFileClick={handleFileClick} />
            ) : (
              <Editor
                projectId={project.id}
                currentCode={code}
                onCodeUpdate={(newCode) => {
                  setCode(newCode)
                  setRightTab('preview')
                }}
                initialMessages={initialMessages}
                selectedCode={selectedCode}
                onClearSelection={() => setSelectedCode(null)}
              />
            )}
          </div>
        </div>

        {/* Drag handle */}
        {sideOpen && (
          <div
            onMouseDown={onDragStart}
            className="relative w-1 shrink-0 cursor-col-resize bg-gray-800 hover:bg-indigo-500 transition-colors"
            style={{ marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4, zIndex: 10 }}
          />
        )}

        {/* Main area: Code + Preview tabs */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-800 bg-gray-900">
            <button
              onClick={() => setRightTab('code')}
              className={`flex items-center gap-1.5 border-r border-gray-800 px-4 py-2 text-xs transition-colors ${
                rightTab === 'code'
                  ? 'border-t-2 border-t-indigo-500 bg-gray-950 text-white'
                  : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <svg className="h-3.5 w-3.5 text-orange-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 18.08L4.08 16 2 6h20l-2.08 10L12 18.08zm-1-4.08l1 .22 1-.22.72-3.5H9.28l.72 3.5z"/>
              </svg>
              index.html
            </button>

            <button
              onClick={() => setRightTab('preview')}
              className={`flex items-center gap-1.5 border-r border-gray-800 px-4 py-2 text-xs transition-colors ${
                rightTab === 'preview'
                  ? 'border-t-2 border-t-indigo-500 bg-gray-950 text-white'
                  : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <svg className="h-3.5 w-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
              </svg>
              Preview
            </button>

            <div className="flex-1" />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'code' ? (
              <CodeEditor
                code={code}
                onSave={handleCodeSave}
                onSelectionChange={(sel) => {
                  setSelectedCode(sel)
                  if (sel) {
                    setActivity('chat')
                    setSideOpen(true)
                  }
                }}
              />
            ) : (
              <Preview code={code} isDragging={previewBlocked} />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
