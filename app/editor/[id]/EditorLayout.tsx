'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import Editor from '@/components/Editor'
import Preview, { type PickedElement } from '@/components/Preview'
import CodeEditor from '@/components/CodeEditor'
import Navigator from '@/components/Navigator'
import ConfettiBurst from '@/components/ConfettiBurst'
import ThemeToggle from '@/components/ThemeToggle'
import ProfileDropdown from '@/components/ProfileDropdown'
import { buildCombinedHtml } from '@/lib/combine'
import { useLessonProgress } from '@/hooks/useLessonProgress'
import type { Project, Message } from '@/types'
import type { Lesson } from '@/lib/lessons'
import type { ClassSlot } from '@/lib/schedule'

interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  args: string[]
  timestamp: Date
}

interface Props {
  project: Project
  initialMessages: Message[]
  lesson: Lesson | null
  initialCompletedTaskIds: string[]
  userEmail: string
  classSlots?: ClassSlot[]
}

// Upper bound on retained preview console output.
const MAX_CONSOLE_ENTRIES = 200

type RightTab = 'code' | 'preview' | 'console'

function getLanguage(filename: string): 'html' | 'css' | 'js' {
  if (filename.endsWith('.css')) return 'css'
  if (filename.endsWith('.js')) return 'js'
  return 'html'
}

export default function EditorLayout({ project, initialMessages, lesson, initialCompletedTaskIds, userEmail, classSlots = [] }: Props) {
  const [files, setFiles] = useState<Record<string, string>>(project.files)
  const [activeFile, setActiveFile] = useState<string>('index.html')
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  // Captured once at mount so it can't flip from true to false on a later
  // re-render that happens to land after the 10s window.
  const [isFreshlyCreated] = useState(() =>
    initialMessages.length === 0 && Date.now() - new Date(project.created_at).getTime() < 10_000
  )
  const [title, setTitle] = useState(project.title)
  const [savingTitle, setSavingTitle] = useState(false)
  const [rightTab, setRightTab] = useState<RightTab>('preview')
  const [splitView, setSplitView] = useState(false)
  // Chat can float free of the sidebar or be docked into it as a regular tab.
  // Only one <Editor> is ever mounted — floating or docked, never both — so
  // message/generation state isn't duplicated across two instances. Docked
  // by default; chatOpen only matters once a student undocks it.
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDocked, setChatDocked] = useState(true)
  // Which docked lesson panel the icon rail is showing — Tasks and AI Tutor
  // no longer stack, they swap.
  const [sidebarView, setSidebarView] = useState<'tasks' | 'chat'>('tasks')
  const [sideWidth, setSideWidth] = useState(420)
  const [previewBlocked, setPreviewBlocked] = useState(false)
  const [selectedCode, setSelectedCode] = useState<{
    text: string
    startLine: number
    endLine: number
    label?: string
    subtitle?: string
    kind?: 'element' | 'text'
  } | null>(null)
  const [inspectMode, setInspectMode] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([])
  const [highlightLines, setHighlightLines] = useState<number[]>([])
  const [highlightNonce, setHighlightNonce] = useState(0)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState<string | null>(null)
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const sideWidthRef = useRef(420)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const isDraggingRef = useRef(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const pendingFilesRef = useRef<Record<string, string> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const savingRef = useRef(false)
  const router = useRouter()

  // How long the student has to stop typing before the project is written to
  // the server. Local state has already updated by then.
  const SAVE_DELAY_MS = 1200

  const flushSave = useCallback(async () => {
    const next = pendingFilesRef.current
    if (!next || savingRef.current) return
    pendingFilesRef.current = null
    savingRef.current = true
    setSaveState('saving')
    try {
      const response = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, files: next }),
      })
      if (!response.ok) throw new Error('save failed')
      setSaveState(pendingFilesRef.current ? 'dirty' : 'saved')
    } catch {
      // Keep the unsaved work queued so the next attempt picks it up.
      pendingFilesRef.current = pendingFilesRef.current ?? next
      setSaveState('dirty')
    } finally {
      savingRef.current = false
      if (pendingFilesRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => { void flushSave() }, SAVE_DELAY_MS)
      }
    }
  }, [project.id])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { void flushSave() }, SAVE_DELAY_MS)
  }, [flushSave])

  // Last-chance write if the student closes the tab mid-edit.
  useEffect(() => {
    function onBeforeUnload() {
      const next = pendingFilesRef.current
      if (!next) return
      void fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, files: next }),
        keepalive: true,
      })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      clearTimeout(saveTimerRef.current)
      onBeforeUnload()
    }
  }, [project.id])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== '__console__') return
      const entry: ConsoleEntry = { level: e.data.level, args: e.data.args, timestamp: new Date() }
      // A student's loop or game can log forever; keep only a recent window so
      // the tab does not grow without bound.
      setConsoleLogs((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_CONSOLE_ENTRIES ? next.slice(-MAX_CONSOLE_ENTRIES) : next
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (rightTab === 'console') {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [consoleLogs, rightTab])

  // The Pick button forces rightTab to 'preview' when arming, but nothing
  // stops the student from tabbing away while still armed (in non-split
  // view); disarm so the button's active state doesn't lie.
  useEffect(() => {
    if (!splitView && rightTab !== 'preview') setInspectMode(false)
  }, [rightTab, splitView])

  // Refetches messages in case the browser served a stale cached RSC payload
  // (e.g. back/forward navigation after the chat moved on since first load).
  // Skipped when the project was created moments ago: no prior render of
  // this page can exist yet for it to have gone stale, so the fetch could
  // only ever return the same empty list already in `initialMessages`.
  useEffect(() => {
    if (isFreshlyCreated) return
    fetch(`/api/projects/${project.id}/messages`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.messages)) setMessages(d.messages) })
      .catch(() => {})
  }, [project.id, isFreshlyCreated])

  const combinedHtml = buildCombinedHtml(files)

  // Reveals chat regardless of whether it's currently docked in the sidebar
  // or floating — the side panel has nothing else to switch away from
  // anymore, so docked chat is already visible whenever it's docked.
  // `setChatOpen` only does anything for the floating panel.
  function openChat() {
    if (!chatDocked) setChatOpen(true)
    else if (lesson) setSidebarView('chat')
  }

  function handleTaskPrompt(p: string) {
    openChat()
    setPendingPrompt(p)
  }

  // Preview picks come with no reliable source line (the rendered DOM can
  // drift from the raw file text — reformatted attributes, injected scripts),
  // so the chip shows a tag label instead of a line range. One-shot: picking
  // disarms inspect mode, same as devtools' "select element" tool.
  function handleInspectPick(el: PickedElement) {
    const subtitle = el.id ? `#${el.id}` : el.classes[0] ? `.${el.classes[0]}` : 'Element'
    setSelectedCode({ text: el.outerHTML, startLine: 0, endLine: 0, label: el.tag, subtitle, kind: 'element' })
    setInspectMode(false)
    openChat()
  }

  // Drives Navigator, which renders both the task list and (once core tasks
  // are done) the folded-in homework section from this one shared state.
  const progress = useLessonProgress({
    lesson,
    projectId: project.id,
    code: files['index.html'] ?? '',
    initialCompletedTaskIds,
    initialSubmissionStatus: project.submission_status,
    onHighlight: (lines) => {
      setHighlightLines(lines)
      setHighlightNonce((n) => n + 1)
      setActiveFile('index.html')
      setRightTab('code')
    },
    onPrompt: handleTaskPrompt,
    // Unique per completion so re-completing the same task id (in theory)
    // still fires a fresh burst.
    onComplete: (task) => setConfettiTrigger(`${task.id}:${Date.now()}`),
  })

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
    pendingFilesRef.current = updatedFiles
    clearTimeout(saveTimerRef.current)
    await flushSave()
  }

  // Typing path: local state updates immediately so the preview and the lesson
  // checks stay live, while the network write is debounced and coalesced.
  function handleCodeChange(newContent: string) {
    if (files[activeFile] === newContent) return
    const updatedFiles = { ...files, [activeFile]: newContent }
    setFiles(updatedFiles)
    pendingFilesRef.current = updatedFiles
    setSaveState('dirty')
    scheduleSave()
  }

  // Escape valve for a wrecked file (e.g. the student deleted everything, or
  // the task's commentAnchor comment got deleted and highlighting broke).
  // Only touches index.html — lesson projects are seeded from templateHtml
  // into that single file, so any other files the student added are kept.
  async function resetToTemplate() {
    if (!lesson) return
    if (!confirm('Undo everything and start over from the template? This cannot be undone.')) return
    const res = await fetch(`/templates/${lesson.templateFile}`)
    const templateHtml = await res.text()
    const restored = { ...files, 'index.html': templateHtml }
    setFiles(restored)
    pendingFilesRef.current = restored
    clearTimeout(saveTimerRef.current)
    await flushSave()
    setActiveFile('index.html')
    setRightTab('code')
  }

  function dockChat() {
    setChatDocked(true)
    setChatOpen(false)
  }

  function undockChat() {
    setChatDocked(false)
    setChatOpen(true)
  }

  const activeLanguage = getLanguage(activeFile)

  const hasConsoleError = consoleLogs.some((entry) => entry.level === 'error')
  // Lesson projects get the simplified student layout: the console is not a
  // peer of Preview — it only appears once something has actually gone
  // wrong. Free-form projects from /explore keep the full developer chrome.
  const showConsoleTab = lesson === null || hasConsoleError

  useEffect(() => {
    if (lesson !== null && rightTab === 'console' && !hasConsoleError) setRightTab('preview')
  }, [lesson, rightTab, hasConsoleError])

  return (
    <div className="flex h-screen flex-col bg-surface-900 font-body">
      <ConfettiBurst trigger={confettiTrigger} />
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-surface-600 bg-surface-800 px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-fg-muted hover:text-fg-primary transition-colors text-xs shrink-0"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          {lesson && (
            <span className="shrink-0 rounded-full border-2 border-surface-600 bg-amber-300 px-2.5 py-0.5 text-[10px] font-bold text-slate-900">
              {lesson.title.split('—')[1]?.trim() ?? lesson.title}
            </span>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="min-w-0 bg-transparent text-sm font-medium text-fg-primary focus:outline-none border-b border-transparent focus:border-surface-600 truncate"
          />
          {savingTitle && <span className="text-xs text-fg-muted shrink-0">Saving...</span>}
        </div>
        <div className="flex items-center gap-4 text-sm shrink-0">
          {project.is_public && (
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${project.id}`)}
              className="text-xs text-fg-secondary hover:text-fg-primary transition-colors"
            >
              Copy link
            </button>
          )}
          <Link href="/lessons" className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block">Lessons</Link>
          <Link href="/explore" className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block">Explore</Link>
          <ThemeToggle />
          <ProfileDropdown email={userEmail} />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Side panel. A lesson project with chat docked shows an icon rail
            to switch between Tasks and AI Tutor; a free-form project always
            shows AI Tutor, no rail needed. It still auto-collapses to width
            0 in the one state with nothing to show: a free-form project
            with chat undocked (floating instead). */}
        <div
          className={`flex flex-col border-r-2 border-surface-600 bg-surface-800 overflow-hidden shrink-0 ${previewBlocked ? '' : 'transition-[width] duration-200'}`}
          style={{ width: (lesson !== null || chatDocked) ? sideWidth : 0 }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b-2 border-surface-600 shrink-0">
            <span className="text-sm font-semibold text-fg-primary">
              {lesson ? (chatDocked && sidebarView === 'chat' ? 'AI Tutor' : 'Tasks') : 'AI Tutor'}
            </span>
            {!lesson && chatDocked && (
              <button
                onClick={undockChat}
                className="text-fg-muted hover:text-fg-secondary transition-colors p-1 rounded hover:bg-surface-700"
                title="Pop out to floating chat"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden relative flex">
            {/* Icon rail — only meaningful when a lesson has both Tasks and a
                docked AI Tutor competing for the sidebar; switches which one
                is shown instead of stacking them. */}
            {lesson && chatDocked && (
              <div className="flex w-10 shrink-0 flex-col items-center gap-1.5 border-r-2 border-surface-600 bg-surface-900/40 py-2">
                <button
                  onClick={() => setSidebarView('tasks')}
                  title="Tasks"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-colors ${
                    sidebarView === 'tasks'
                      ? 'border-brand-500 bg-brand-500/20 text-brand-600 dark:text-brand-300'
                      : 'border-transparent text-fg-muted hover:bg-surface-700'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setSidebarView('chat')}
                  title="AI Tutor"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-colors ${
                    sidebarView === 'chat'
                      ? 'border-brand-500 bg-brand-500/20 text-brand-600 dark:text-brand-300'
                      : 'border-transparent text-fg-muted hover:bg-surface-700'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              {/* Lesson projects: Tasks (with homework folded in once core is
                  done) and the docked AI Tutor swap via the icon rail above —
                  only one is visible at a time, kept mounted (not unmounted)
                  so switching away mid-generation doesn't lose Editor state.
                  Undocking always falls back to Tasks-only, since chat floats
                  free instead. */}
              {lesson && (
                <div className={`h-full ${sidebarView === 'tasks' || !chatDocked ? '' : 'hidden'}`}>
                  <div className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-surface-600 bg-surface-800 m-2 shadow-hard-sm">
                    <div className="flex shrink-0 items-center gap-1.5 border-b-2 border-surface-600 bg-surface-700 px-3 py-1.5">
                      <svg className="h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-bold uppercase tracking-wide text-fg-secondary">Tasks</span>
                    </div>
                    <div className="min-h-0 flex-1">
                      <Navigator
                        lesson={lesson}
                        code={files['index.html'] ?? ''}
                        progress={progress}
                        classSlots={classSlots}
                      />
                    </div>
                  </div>
                </div>
              )}
              {lesson && chatDocked && (
                <div className={`h-full ${sidebarView === 'chat' ? '' : 'hidden'}`}>
                  <div className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-surface-600 bg-surface-800 m-2 shadow-hard-sm">
                    <div className="flex shrink-0 items-center justify-between gap-1.5 border-b-2 border-surface-600 bg-surface-700 px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-sm font-bold uppercase tracking-wide text-fg-secondary">AI Tutor</span>
                      </div>
                      <button
                        onClick={undockChat}
                        className="text-fg-muted hover:text-fg-secondary transition-colors p-1 rounded hover:bg-surface-600"
                        title="Pop out to floating chat"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </div>
                    <div className="min-h-0 flex-1">
                      <Editor
                        projectId={project.id}
                        files={files}
                        onFilesUpdate={(newFiles) => {
                          setFiles(newFiles)
                          setRightTab('preview')
                          setConsoleLogs([])
                        }}
                        activeFile={activeFile}
                        messages={messages}
                        onMessagesChange={setMessages}
                        selectedCode={selectedCode}
                        onClearSelection={() => setSelectedCode(null)}
                        pendingPrompt={pendingPrompt}
                        onPromptConsumed={() => setPendingPrompt(null)}
                      />
                    </div>
                  </div>
                </div>
              )}
              {/* Free-form /explore projects: chat is the whole panel, no lesson
                  Tasks to switch away from. */}
              {chatDocked && !lesson && (
                <div className="h-full">
                  <Editor
                    projectId={project.id}
                    files={files}
                    onFilesUpdate={(newFiles) => {
                      setFiles(newFiles)
                      setRightTab('preview')
                      setConsoleLogs([])
                    }}
                    activeFile={activeFile}
                    messages={messages}
                    onMessagesChange={setMessages}
                    selectedCode={selectedCode}
                    onClearSelection={() => setSelectedCode(null)}
                    pendingPrompt={pendingPrompt}
                    onPromptConsumed={() => setPendingPrompt(null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="relative w-1 shrink-0 cursor-col-resize bg-surface-600 hover:bg-brand-500 transition-colors"
          style={{ marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4, zIndex: 10 }}
        />

        {/* Main area: Code + Preview tabs */}
        <div className="relative flex flex-1 flex-col overflow-hidden">

          {/* Tab bar — one tab per file, always: with the Files panel gone
              there's no other way to reach a file, so every key in `files`
              (including any the AI generates mid-session) has to render
              here rather than an "opened" subset a student could lose. */}
          <div className="flex items-center overflow-x-auto border-b-2 border-surface-600 bg-surface-900 px-2 gap-1">
            {Object.keys(files).map((filename) => (
              <button
                key={filename}
                onClick={() => { setActiveFile(filename); setRightTab('code'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors rounded-md my-1 border-2 shrink-0 ${
                  rightTab === 'code' && activeFile === filename
                    ? 'border-surface-600 bg-surface-700 text-fg-primary shadow-hard-sm'
                    : 'border-transparent text-fg-muted hover:bg-surface-700/60 hover:text-fg-secondary'
                }`}
              >
                {filename.endsWith('.css') ? (
                  <svg className="h-3.5 w-3.5 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 3h14l-1.68 15L12 21l-5.32-3L5 3zm2.17 2L8.5 17.13 12 18.87l3.5-1.74L16.83 5H7.17z"/>
                  </svg>
                ) : filename.endsWith('.js') ? (
                  <svg className="h-3.5 w-3.5 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h18v18H3V3zm10.71 14.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41-.17-.17-.38-.27-.61-.29-.23-.01-.46.08-.63.25-.17.18-.26.41-.25.64.01.23.11.44.28.61zm-3.44-.61c.14.47.44.84.85 1.07.41.23.9.29 1.36.17.38-.1.71-.33.94-.64l-1.03-.6c-.09.13-.21.22-.36.26-.15.04-.3.02-.44-.06-.1-.06-.18-.15-.22-.27l-.02-.06-1.08.13z"/>
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 18.08L4.08 16 2 6h20l-2.08 10L12 18.08zm-1-4.08l1 .22 1-.22.72-3.5H9.28l.72 3.5z"/>
                  </svg>
                )}
                {filename}
              </button>
            ))}

            <button
              onClick={() => setRightTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors rounded-md my-1 border-2 ${
                rightTab === 'preview'
                  ? 'border-surface-600 bg-surface-700 text-fg-primary shadow-hard-sm'
                  : 'border-transparent text-fg-muted hover:bg-surface-700/60 hover:text-fg-secondary'
              }`}
            >
              <svg className="h-3.5 w-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
              </svg>
              Preview
            </button>

            {showConsoleTab && (
              <button
                onClick={() => setRightTab('console')}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${lesson !== null ? 'text-sm' : 'text-xs'} transition-colors rounded-md my-1 border-2 ${
                  rightTab === 'console'
                    ? 'border-surface-600 bg-surface-700 text-fg-primary shadow-hard-sm'
                    : lesson !== null
                      ? 'border-transparent text-amber-600 dark:text-amber-400 hover:bg-surface-700/60'
                      : 'border-transparent text-fg-muted hover:bg-surface-700/60 hover:text-fg-secondary'
                }`}
              >
                <svg className={`h-3.5 w-3.5 shrink-0 ${lesson !== null ? 'text-amber-500' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                </svg>
                {lesson !== null ? 'Something went wrong' : 'Console'}
                {hasConsoleError && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                )}
              </button>
            )}

            <div className="flex-1" />

            {lesson && (
              <button
                onClick={resetToTemplate}
                className="flex items-center gap-1 px-2 py-1 mx-1 text-xs rounded transition-colors text-fg-muted hover:text-fg-primary"
                title="Reset to the starter template"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset
              </button>
            )}

            <button
              onClick={() => {
                if (!splitView) setRightTab('preview')
                setInspectMode(v => !v)
              }}
              className={`flex items-center gap-1 px-2 py-1 mx-1 text-xs rounded-md border-2 transition-colors ${inspectMode ? 'border-surface-600 bg-brand-500/20 text-brand-600 dark:text-brand-300 shadow-hard-sm' : 'border-transparent text-fg-muted hover:text-fg-primary'}`}
              title="Pick an element from the preview"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
              </svg>
              Pick
            </button>

            <button
              onClick={() => {
                if (!splitView && rightTab === 'console') setRightTab('code')
                setSplitView(v => !v)
              }}
              className={`flex items-center gap-1 px-2 py-1 mx-1 text-xs rounded-md border-2 transition-colors ${splitView ? 'border-surface-600 bg-brand-500/20 text-brand-600 dark:text-brand-300 shadow-hard-sm' : 'border-transparent text-fg-muted hover:text-fg-primary'}`}
              title="Split view"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="1" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </button>

            {combinedHtml && (
              <button
                onClick={() => {
                  const blob = new Blob([combinedHtml], { type: 'text/html' })
                  const url = URL.createObjectURL(blob)
                  window.open(url, '_blank')
                }}
                className="mr-2 flex items-center gap-1 text-xs text-fg-muted hover:text-fg-secondary transition-colors"
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
          {splitView ? (
            <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
              <Panel defaultSize={50} minSize={20}>
                <CodeEditor
                  key={activeFile}
                  code={files[activeFile] ?? ''}
                  language={activeLanguage}
                  onSave={handleCodeSave}
                  onChange={handleCodeChange}
                  saveState={saveState}
                  highlightLines={highlightLines}
                  highlightNonce={highlightNonce}
                  onSelectionChange={(sel) => {
                    setSelectedCode(
                      sel
                        ? {
                            ...sel,
                            kind: 'text',
                            label: sel.startLine === sel.endLine ? `Line ${sel.startLine}` : `Lines ${sel.startLine}–${sel.endLine}`,
                            subtitle: activeFile,
                          }
                        : null
                    )
                    if (sel) {
                      openChat()
                    }
                  }}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-surface-600 hover:bg-brand-500 cursor-col-resize transition-colors" />
              <Panel defaultSize={50} minSize={20}>
                <Preview code={combinedHtml} isDragging={previewBlocked} inspectMode={inspectMode} onInspectPick={handleInspectPick} />
              </Panel>
            </PanelGroup>
          ) : (
            <div className="flex-1 overflow-hidden relative">
              {/* Code — unmount when not active is fine, CodeEditor has no side-effects on mount */}
              {rightTab === 'code' && (
                <CodeEditor
                  key={activeFile}
                  code={files[activeFile] ?? ''}
                  language={activeLanguage}
                  onSave={handleCodeSave}
                  onChange={handleCodeChange}
                  saveState={saveState}
                  highlightLines={highlightLines}
                  highlightNonce={highlightNonce}
                  onSelectionChange={(sel) => {
                    setSelectedCode(
                      sel
                        ? {
                            ...sel,
                            kind: 'text',
                            label: sel.startLine === sel.endLine ? `Line ${sel.startLine}` : `Lines ${sel.startLine}–${sel.endLine}`,
                            subtitle: activeFile,
                          }
                        : null
                    )
                    if (sel) {
                      openChat()
                    }
                  }}
                />
              )}

              {/* Preview — always mounted so iframe never reloads on tab switch */}
              <div className={`absolute inset-0 ${rightTab === 'preview' ? '' : 'invisible pointer-events-none'}`}>
                <Preview code={combinedHtml} isDragging={previewBlocked} inspectMode={inspectMode} onInspectPick={handleInspectPick} />
              </div>

              {/* Console */}
              {rightTab === 'console' && (
                <div className="flex h-full flex-col bg-surface-900 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-surface-600 px-3 py-1.5 shrink-0">
                    <span className="text-fg-muted">
                      {consoleLogs.length} {consoleLogs.length === 1 ? 'message' : 'messages'}
                    </span>
                    <button
                      onClick={() => setConsoleLogs([])}
                      className="text-fg-muted hover:text-fg-secondary transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {consoleLogs.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-fg-muted">
                        No console output
                      </div>
                    ) : (
                      consoleLogs.map((entry, i) => (
                        <div
                          key={i}
                          className={`flex gap-2 border-b border-surface-700 px-3 py-1.5 ${
                            entry.level === 'error'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : entry.level === 'warn'
                              ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                              : 'text-fg-secondary'
                          }`}
                        >
                          <span className="shrink-0 text-fg-muted">
                            {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className={`shrink-0 uppercase w-10 ${
                            entry.level === 'error' ? 'text-red-500' :
                            entry.level === 'warn' ? 'text-yellow-500' :
                            'text-fg-muted'
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
          )}

          {/* Floating chat bubble — the only trigger for chat while it's
              undocked (there's no icon rail to reopen it from). Hidden while
              the floating panel itself is open, since that panel has its own
              close button in the same corner. Hidden entirely once chat is
              docked into the sidebar. */}
          {!chatOpen && !chatDocked && (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border-2 border-surface-600 bg-brand-500 text-white shadow-hard hover:bg-brand-400 hover:scale-105 active:scale-95 transition-all animate-pop-in"
              title="Chat with AI Tutor"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}

          {/* Floating chat panel — deliberately not a sidebar tab, so a lesson's
              Tasks list (homework included) stays visible while the student is chatting.
              Kept mounted at all times (visibility/transform toggled, never
              unmounted) so an in-flight generation and pendingPrompt handoff
              survive open/close, and so open/close can animate smoothly.
              Anchored to this main (code/preview) column, not the viewport,
              so it never overlaps the sidebar. Unmounted once docked, since
              the sidebar copy takes over as the single <Editor> instance. */}
          {!chatDocked && (
            <div
              className={`absolute bottom-4 right-4 z-30 flex h-[32rem] w-96 max-w-[calc(100%-2rem)] max-h-[70%] origin-bottom-right flex-col overflow-hidden rounded-xl border-2 border-surface-600 bg-surface-800 shadow-hard transition-all duration-200 ease-out ${
                chatOpen
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-90 translate-y-3 pointer-events-none invisible'
              }`}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b-2 border-surface-600 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-sm font-semibold text-fg-primary">AI Tutor</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={dockChat}
                    className="text-fg-muted hover:text-fg-secondary transition-colors p-1 rounded hover:bg-surface-700"
                    title="Dock to sidebar"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="text-fg-muted hover:text-fg-secondary transition-colors p-1 rounded hover:bg-surface-700"
                    title="Close chat"
                  >
                    &times;
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <Editor
                  projectId={project.id}
                  files={files}
                  onFilesUpdate={(newFiles) => {
                    setFiles(newFiles)
                    setRightTab('preview')
                    setConsoleLogs([])
                  }}
                  activeFile={activeFile}
                  messages={messages}
                  onMessagesChange={setMessages}
                  selectedCode={selectedCode}
                  onClearSelection={() => setSelectedCode(null)}
                  pendingPrompt={pendingPrompt}
                  onPromptConsumed={() => setPendingPrompt(null)}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
