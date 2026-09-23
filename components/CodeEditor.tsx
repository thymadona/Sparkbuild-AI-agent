'use client'

import { useState, useEffect, useRef } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ViewUpdate } from '@codemirror/view'

interface CodeEditorProps {
  code: string
  onSave: (code: string) => void
  // Called while the student types, debounced. Drives the live preview and the
  // lesson checks.
  onChange?: (code: string) => void
  saveState?: 'saved' | 'saving' | 'dirty'
  // Fired once the underlying view mounts, so a caller (the mobile toolbar's
  // undo/redo and quick-insert buttons) can dispatch CodeMirror commands
  // directly instead of needing a second editor instance.
  onViewReady?: (view: EditorView) => void
  // Soft-wrap long lines instead of horizontal scroll. Off by default so
  // desktop is unchanged; the mobile shell turns it on — a touch horizontal
  // scroll on a narrow screen is worse than a long line taking extra rows.
  wrap?: boolean
  // For hosts that show their own status (the tutor board).
  hideToolbar?: boolean
}

// Short enough that the preview feels live, long enough not to re-render on
// every keystroke.
const LIVE_DELAY_MS = 300

// oneDark's syntax colours on the espresso surface used by the /board code block.
const parchmentDark = [
  oneDark,
  EditorView.theme(
    {
      '&': { backgroundColor: '#2b2118' },
      '.cm-gutters': { backgroundColor: '#2b2118', borderRight: 'none' },
      '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(250, 246, 238, 0.06)' },
      '.cm-content': { paddingTop: '12px' },
      '.cm-content, .cm-scroller': { fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
    },
    { dark: true }
  ),
]

export default function CodeEditor({
  code,
  onSave,
  onChange,
  saveState,
  onViewReady,
  wrap,
  hideToolbar,
}: CodeEditorProps) {
  const [draft, setDraft] = useState(code)
  const viewRef = useRef<EditorView | null>(null)
  const lastEmitted = useRef(code)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Adopt changes that came from somewhere else — an AI generation, or a file
  // switch — without clobbering what the student is typing. Anything we pushed
  // up ourselves comes back identical and is ignored.
  useEffect(() => {
    if (code === lastEmitted.current) return
    // An external update supersedes any local edit still waiting on the live
    // timer — otherwise that timer fires later with a stale value and
    // clobbers what just arrived (e.g. an AI generation while split view is open).
    clearTimeout(liveTimer.current)
    lastEmitted.current = code
    setDraft(code)
  }, [code])

  useEffect(() => () => clearTimeout(liveTimer.current), [])

  function handleChange(value: string) {
    setDraft(value)
    if (!onChange) return
    clearTimeout(liveTimer.current)
    liveTimer.current = setTimeout(() => {
      lastEmitted.current = value
      onChange(value)
    }, LIVE_DELAY_MS)
  }

  function flush() {
    clearTimeout(liveTimer.current)
    lastEmitted.current = draft
    onSave(draft)
  }

  function handleUpdate(vu: ViewUpdate) {
    // capture view ref
    if (viewRef.current !== vu.view) {
      viewRef.current = vu.view
      onViewReady?.(vu.view)
    }
  }

  const extensions = [python(), ...(wrap ? [EditorView.lineWrapping] : [])]

  const autosaving = Boolean(onChange)
  const statusLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'dirty'
        ? 'Saving in a moment…'
        : 'All changes saved'

  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault()
          flush()
        }
      }}
    >
      {!hideToolbar && (
        <div className="flex items-center justify-end gap-3 border-b border-surface-600 bg-surface-800 px-3 py-1.5">
          {autosaving ? (
            <span
              className={`text-xs ${saveState === 'saved' ? 'text-fg-muted' : 'text-fg-secondary'}`}
              aria-live="polite"
            >
              {statusLabel}
            </span>
          ) : (
            <button
              onClick={flush}
              disabled={draft === code}
              className="text-xs rounded bg-brand-500 px-3 py-1 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={draft}
          height="100%"
          theme={parchmentDark}
          extensions={extensions}
          onChange={handleChange}
          onUpdate={handleUpdate}
          style={{ height: '100%', fontSize: wrap ? '16px' : '13px' }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            autocompletion: true,
          }}
        />
      </div>
    </div>
  )
}
