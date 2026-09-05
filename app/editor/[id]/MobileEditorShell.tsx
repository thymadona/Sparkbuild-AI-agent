'use client'

import { useRef, useState } from 'react'
import { undo, redo } from '@codemirror/commands'
import type { EditorView } from '@uiw/react-codemirror'
import Editor from '@/components/Editor'
import Preview from '@/components/Preview'
import CodeEditor from '@/components/CodeEditor'
import Navigator from '@/components/Navigator'
import ThemeToggle from '@/components/ThemeToggle'
import ProfileDropdown from '@/components/ProfileDropdown'
import { cn } from '@/lib/utils'
import type { Project, Message } from '@/types'
import type { Lesson } from '@/lib/lessons'
import type { ClassSlot } from '@/lib/schedule'
import type { useLessonProgress } from '@/hooks/useLessonProgress'
import type { ConsoleEntry } from './EditorLayout'

type MobileTab = 'tasks' | 'preview' | 'code' | 'chat'

type SelectedCode = {
  text: string
  startLine: number
  endLine: number
  label?: string
  subtitle?: string
  kind?: 'element' | 'text'
} | null

interface Props {
  project: Project
  lesson: Lesson | null
  classSlots: ClassSlot[]
  files: Record<string, string>
  activeFile: string
  activeLanguage: 'html' | 'css' | 'js'
  combinedHtml: string
  progress: ReturnType<typeof useLessonProgress>
  messages: Message[]
  onMessagesChange: (msgs: Message[] | ((prev: Message[]) => Message[])) => void
  onFilesUpdate: (files: Record<string, string>) => void
  selectedCode: SelectedCode
  onClearSelection: () => void
  onCodeSelectionChange: (sel: { text: string; startLine: number; endLine: number } | null) => void
  pendingPrompt: string | null
  onPromptConsumed: () => void
  mobileTab: MobileTab
  setMobileTab: (tab: MobileTab) => void
  handleCodeChange: (code: string) => void
  handleCodeSave: (code: string) => void
  saveState: 'saved' | 'saving' | 'dirty'
  highlightLines: number[]
  highlightNonce: number
  consoleLogs: ConsoleEntry[]
  hasConsoleError: boolean
  onClearConsole: () => void
  resetToTemplate: () => void
  title: string
  setTitle: (t: string) => void
  handleTitleBlur: () => void
  savingTitle: boolean
  userEmail: string
  onBack: () => void
}

const TAB_ICONS: Record<MobileTab, React.ReactNode> = {
  tasks: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  preview: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  ),
  code: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3m8-6l4 3-4 3M14 4l-4 16" />
    </svg>
  ),
  chat: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
}

// Quick-insert accessory row for the on-screen keyboard — the one thing the
// mockup shows that has no desktop equivalent at all (font size is hardcoded,
// there's no touch-friendly way to type these characters otherwise).
const QUICK_INSERTS = ['<', '>', '/', '"', '=', '{', '}', ':', ';']

export default function MobileEditorShell({
  project,
  lesson,
  classSlots,
  files,
  activeFile,
  activeLanguage,
  combinedHtml,
  progress,
  messages,
  onMessagesChange,
  onFilesUpdate,
  selectedCode,
  onClearSelection,
  onCodeSelectionChange,
  pendingPrompt,
  onPromptConsumed,
  mobileTab,
  setMobileTab,
  handleCodeChange,
  handleCodeSave,
  saveState,
  highlightLines,
  highlightNonce,
  consoleLogs,
  hasConsoleError,
  onClearConsole,
  resetToTemplate,
  title,
  setTitle,
  handleTitleBlur,
  savingTitle,
  userEmail,
  onBack,
}: Props) {
  const viewRef = useRef<EditorView | null>(null)
  const [consoleOpen, setConsoleOpen] = useState(false)

  // Free-form (/explore) projects have no lesson, so no Tasks tab — desktop
  // gives the whole sidebar to <Editor> in that case (see EditorLayout's
  // `chatDocked && !lesson` branch); mobile mirrors it with a 3-way nav.
  const tabs: MobileTab[] = lesson ? ['tasks', 'preview', 'code', 'chat'] : ['preview', 'code', 'chat']
  const showConsolePanel = lesson === null || hasConsoleError

  function insertAtCursor(text: string) {
    const view = viewRef.current
    if (!view) return
    const from = view.state.selection.main.from
    view.dispatch({ changes: { from, insert: text }, selection: { anchor: from + text.length } })
    view.focus()
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-surface-900 font-body">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b-2 border-surface-600 bg-surface-800 px-3">
        <button onClick={onBack} className="shrink-0 p-1 text-fg-muted hover:text-fg-primary transition-colors" aria-label="Back to dashboard">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {lesson && (
          <span className="shrink-0 rounded-full border-2 border-surface-600 bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-slate-900">
            {lesson.title.split('—')[1]?.trim() ?? lesson.title}
          </span>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-fg-primary focus:outline-none truncate"
        />
        {savingTitle && <span className="shrink-0 text-[10px] text-fg-muted">Saving…</span>}
        <ThemeToggle />
        <ProfileDropdown email={userEmail} />
      </header>

      {/* Segmented nav */}
      <nav aria-label="Workspace views" role="tablist" className="flex shrink-0 gap-1 border-b-2 border-surface-600 bg-surface-800 p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={mobileTab === tab}
            aria-current={mobileTab === tab ? 'true' : undefined}
            onClick={() => setMobileTab(tab)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-lg border-2 py-1.5 text-[11px] font-semibold capitalize transition-colors',
              mobileTab === tab
                ? 'border-surface-600 bg-brand-500/20 text-brand-600 shadow-hard-sm dark:text-brand-300'
                : 'border-transparent text-fg-muted hover:bg-surface-700'
            )}
          >
            {TAB_ICONS[tab]}
            {tab === 'chat' ? 'Tutor' : tab}
          </button>
        ))}
      </nav>

      {/* Content — one section per tab. Navigator/Preview/CodeEditor/Editor
          each own significant state (task progress, iframe, CodeMirror doc,
          chat draft) so tabs are shown/hidden, not conditionally rendered,
          except CodeEditor which is documented safe to remount per file/tab
          switch (see CodeEditor.tsx and EditorLayout's own non-split view). */}
      <div className="relative flex-1 overflow-hidden">
        {lesson && (
          <div className={cn('absolute inset-0', mobileTab === 'tasks' ? '' : 'hidden')}>
            <Navigator lesson={lesson} code={files['index.html'] ?? ''} progress={progress} classSlots={classSlots} />
          </div>
        )}

        <div className={cn('absolute inset-0 flex flex-col', mobileTab === 'preview' ? '' : 'hidden')}>
          <div className="min-h-0 flex-1">
            <Preview code={combinedHtml} />
          </div>
          {showConsolePanel && (
            <div className="shrink-0 border-t-2 border-surface-600 bg-surface-900">
              <button
                onClick={() => setConsoleOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-fg-muted"
              >
                <span className="flex items-center gap-1.5">
                  Console
                  {consoleLogs.length > 0 && <span className="text-fg-muted">({consoleLogs.length})</span>}
                  {hasConsoleError && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                </span>
                <span>{consoleOpen ? '▾' : '▸'}</span>
              </button>
              {consoleOpen && (
                <div className="max-h-40 overflow-y-auto border-t border-surface-700 font-mono text-[11px]">
                  <div className="flex items-center justify-end px-3 py-1">
                    <button onClick={onClearConsole} className="text-fg-muted hover:text-fg-secondary transition-colors">Clear</button>
                  </div>
                  {consoleLogs.length === 0 ? (
                    <div className="px-3 pb-2 text-fg-muted">No console output</div>
                  ) : (
                    consoleLogs.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex gap-2 border-t border-surface-700 px-3 py-1',
                          entry.level === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : entry.level === 'warn' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' : 'text-fg-secondary'
                        )}
                      >
                        <span className="shrink-0 uppercase text-fg-muted">{entry.level}</span>
                        <span className="break-all whitespace-pre-wrap">{entry.args.join(' ')}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={cn('absolute inset-0 flex flex-col', mobileTab === 'code' ? '' : 'hidden')}>
          <div className="flex shrink-0 items-center gap-2 border-b-2 border-surface-600 bg-surface-800 px-2 py-1.5">
            <span className="rounded border-2 border-surface-600 bg-surface-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-fg-muted">
              {activeLanguage}
            </span>
            <span className="truncate text-xs text-fg-secondary">{activeFile}</span>
            <span className="text-[10px] text-fg-muted">
              {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Saving in a moment…' : 'Saved'}
            </span>
            <div className="flex-1" />
            {lesson && (
              <button
                onClick={resetToTemplate}
                className="p-1 text-fg-muted hover:text-fg-primary transition-colors"
                title="Reset to the starter template"
                aria-label="Reset to the starter template"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button
              onClick={() => viewRef.current && undo(viewRef.current)}
              className="p-1 text-fg-muted hover:text-fg-primary transition-colors"
              title="Undo"
              aria-label="Undo"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" />
              </svg>
            </button>
            <button
              onClick={() => viewRef.current && redo(viewRef.current)}
              className="p-1 text-fg-muted hover:text-fg-primary transition-colors"
              title="Redo"
              aria-label="Redo"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v5h-.581m0 0a8.003 8.003 0 00-15.357-2M4.582 15A8.001 8.001 0 0015 20" />
              </svg>
            </button>
            <button onClick={() => setMobileTab('preview')} className="rounded-md border-2 border-surface-600 bg-teal-400 px-2 py-1 text-[11px] font-bold text-slate-900">
              Run ▶
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <CodeEditor
              key={activeFile}
              code={files[activeFile] ?? ''}
              language={activeLanguage}
              onSave={handleCodeSave}
              onChange={handleCodeChange}
              saveState={saveState}
              highlightLines={highlightLines}
              highlightNonce={highlightNonce}
              onSelectionChange={onCodeSelectionChange}
              onViewReady={(view) => { viewRef.current = view }}
              wrap
            />
            <button
              onClick={() => setMobileTab('preview')}
              className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border-2 border-surface-600 bg-surface-800 px-2.5 py-1.5 text-[11px] font-semibold text-fg-primary shadow-hard-sm"
              title="Jump to the live preview"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
              Live Preview →
            </button>
          </div>

          <div className="flex shrink-0 gap-1 overflow-x-auto border-t-2 border-surface-600 bg-surface-800 px-2 py-1.5">
            {QUICK_INSERTS.map((sym) => (
              <button
                key={sym}
                onClick={() => insertAtCursor(sym)}
                className="shrink-0 rounded-md border-2 border-surface-600 bg-surface-700 px-2.5 py-1 font-mono text-xs text-fg-primary active:bg-surface-600"
              >
                {sym}
              </button>
            ))}
            <button onClick={() => insertAtCursor('class=""')} className="shrink-0 rounded-md border-2 border-surface-600 bg-surface-700 px-2.5 py-1 text-xs text-fg-primary active:bg-surface-600">class</button>
            <button onClick={() => insertAtCursor('var(--)')} className="shrink-0 rounded-md border-2 border-surface-600 bg-surface-700 px-2.5 py-1 text-xs text-fg-primary active:bg-surface-600">var()</button>
            <button onClick={() => insertAtCursor('\t')} className="shrink-0 rounded-md border-2 border-surface-600 bg-surface-700 px-2.5 py-1 text-xs text-fg-primary active:bg-surface-600">⇥ Tab</button>
          </div>
        </div>

        <div className={cn('absolute inset-0', mobileTab === 'chat' ? '' : 'hidden')}>
          <Editor
            projectId={project.id}
            files={files}
            onFilesUpdate={onFilesUpdate}
            activeFile={activeFile}
            messages={messages}
            onMessagesChange={onMessagesChange}
            selectedCode={selectedCode}
            onClearSelection={onClearSelection}
            pendingPrompt={pendingPrompt}
            onPromptConsumed={onPromptConsumed}
          />
        </div>
      </div>
    </div>
  )
}
