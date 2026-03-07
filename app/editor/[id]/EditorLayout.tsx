'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Editor from '@/components/Editor'
import Preview from '@/components/Preview'
import FileTree from '@/components/FileTree'
import CodeEditor from '@/components/CodeEditor'
import { buildCombinedHtml } from '@/lib/combine'
import type { Project, Message } from '@/types'

interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  args: string[]
  timestamp: Date
}

interface Props {
  project: Project
  initialMessages: Message[]
}

type RightTab = 'code' | 'preview' | 'console'
type Activity = 'explorer' | 'chat'

function getLanguage(filename: string): 'html' | 'css' | 'js' {
  if (filename.endsWith('.css')) return 'css'
  if (filename.endsWith('.js')) return 'js'
  return 'html'
}

export default function EditorLayout({ project, initialMessages }: Props) {
  const [files, setFiles] = useState<Record<string, string>>(project.files)
  const [activeFile, setActiveFile] = useState<string>('index.html')
  const [title, setTitle] = useState(project.title)
  const [savingTitle, setSavingTitle] = useState(false)
  const [rightTab, setRightTab] = useState<RightTab>('preview')
  const [activity, setActivity] = useState<Activity>('chat')
  const [sideOpen, setSideOpen] = useState(true)
  const [sideWidth, setSideWidth] = useState(380)
  const [previewBlocked, setPreviewBlocked] = useState(false)
  const [selectedCode, setSelectedCode] = useState<{ text: string; startLine: number; endLine: number } | null>(null)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([])
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const sideWidthRef = useRef(380)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const isDraggingRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== '__console__') return
      const entry: ConsoleEntry = { level: e.data.level, args: e.data.args, timestamp: new Date() }
      setConsoleLogs((prev) => [...prev, entry])
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (rightTab === 'console') {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [consoleLogs, rightTab])

  const combinedHtml = buildCombinedHtml(files)

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

  async function handleCodeSave(newContent: string) {
    const updatedFiles = { ...files, [activeFile]: newContent }
    setFiles(updatedFiles)
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, files: updatedFiles }),
    })
  }

  function handleFileClick(filename: string) {
    setActiveFile(filename)
    setRightTab('code')
  }

  async function handleAddFile(filename: string) {
    const updatedFiles = { ...files, [filename]: '' }
    setFiles(updatedFiles)
    setActiveFile(filename)
    setRightTab('code')
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, files: updatedFiles }),
    })
  }

  function handleActivity(clicked: Activity) {
    if (clicked === activity) {
      setSideOpen((o) => !o)
    } else {
      setActivity(clicked)
      setSideOpen(true)
    }
  }

  const activeLanguage = getLanguage(activeFile)

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
              <FileTree
                files={files}
                activeFile={activeFile}
                onFileClick={handleFileClick}
                onAddFile={handleAddFile}
              />
            ) : (
              <Editor
                projectId={project.id}
                files={files}
                onFilesUpdate={(newFiles) => {
                  setFiles(newFiles)
                  setRightTab('preview')
                  setConsoleLogs([])
                }}
                activeFile={activeFile}
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
              {activeFile}
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

            <button
              onClick={() => setRightTab('console')}
              className={`flex items-center gap-1.5 border-r border-gray-800 px-4 py-2 text-xs transition-colors ${
                rightTab === 'console'
                  ? 'border-t-2 border-t-indigo-500 bg-gray-950 text-white'
                  : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <svg className="h-3.5 w-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
                <rect x="3" y="4" width="18" height="16" rx="2" />
              </svg>
              Console
              {consoleLogs.some(l => l.level === 'error') && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              )}
            </button>

            <div className="flex-1" />

            {combinedHtml && (
              <button
                onClick={() => {
                  const blob = new Blob([combinedHtml], { type: 'text/html' })
                  const url = URL.createObjectURL(blob)
                  window.open(url, '_blank')
                }}
                className="mr-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                title="Open preview in new tab"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open
              </button>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden relative">
            {/* Code — unmount when not active is fine, CodeEditor has no side-effects on mount */}
            {rightTab === 'code' && (
              <CodeEditor
                code={files[activeFile] ?? ''}
                language={activeLanguage}
                onSave={handleCodeSave}
                onSelectionChange={(sel) => {
                  setSelectedCode(sel)
                  if (sel) {
                    setActivity('chat')
                    setSideOpen(true)
                  }
                }}
              />
            )}

            {/* Preview — always mounted so iframe never reloads on tab switch */}
            <div className={`absolute inset-0 ${rightTab === 'preview' ? '' : 'invisible pointer-events-none'}`}>
              <Preview code={combinedHtml} isDragging={previewBlocked} />
            </div>

            {/* Console */}
            {rightTab === 'console' && (
              <div className="flex h-full flex-col bg-gray-950 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-gray-800 px-3 py-1.5 shrink-0">
                  <span className="text-gray-500">
                    {consoleLogs.length} {consoleLogs.length === 1 ? 'message' : 'messages'}
                  </span>
                  <button
                    onClick={() => setConsoleLogs([])}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {consoleLogs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-gray-600">
                      No console output
                    </div>
                  ) : (
                    consoleLogs.map((entry, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 border-b border-gray-900 px-3 py-1.5 ${
                          entry.level === 'error'
                            ? 'bg-red-950/30 text-red-400'
                            : entry.level === 'warn'
                            ? 'bg-yellow-950/30 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      >
                        <span className="shrink-0 text-gray-600">
                          {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`shrink-0 uppercase w-10 ${
                          entry.level === 'error' ? 'text-red-500' :
                          entry.level === 'warn' ? 'text-yellow-500' :
                          'text-gray-500'
                        }`}>{entry.level}</span>
                        <span className="break-all whitespace-pre-wrap">{entry.args.join(' ')}</span>
                      </div>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
