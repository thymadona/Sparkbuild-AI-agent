'use client'

import { useState, useEffect, useRef } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from 'next-themes'
import { Decoration, DecorationSet } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state'
import type { ViewUpdate } from '@codemirror/view'

interface CodeEditorProps {
  code: string
  onSave: (code: string) => void
  language?: 'html' | 'css' | 'js'
  onSelectionChange?: (selection: { text: string; startLine: number; endLine: number } | null) => void
  highlightLines?: number[] | null
  // Bumped every time the parent asks to point at a line, so asking twice for
  // the same line scrolls there again.
  highlightNonce?: number
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
}

// Short enough that the preview feels live, long enough not to re-render on
// every keystroke.
const LIVE_DELAY_MS = 300

interface HighlightRange {
  from: number
  to: number
}

const addHighlight = StateEffect.define<{ ranges: HighlightRange[]; pulseClass: string }>()
const clearHighlight = StateEffect.define<null>()

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(addHighlight)) {
        const mark = Decoration.line({ class: `cm-lesson-highlight ${e.value.pulseClass}` })
        deco = Decoration.set(
          e.value.ranges.map((r) => mark.range(r.from)),
          true
        )
      } else if (e.is(clearHighlight)) {
        deco = Decoration.none
      }
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

// Two classes with identical keyframes, alternated by highlightNonce parity —
// a CSS animation does not restart when the same class is re-applied to an
// element that already has it, and re-pointing at the same line (repeated
// "Show me where" clicks, or a tier-3 escalation on the line the student is
// already viewing) needs to replay the pulse every time.
const highlightTheme = EditorView.baseTheme({
  '.cm-lesson-highlight': {
    backgroundColor: 'rgba(99, 102, 241, 0.25) !important',
    borderLeft: '2px solid #818cf8',
  },
  '.cm-lesson-pulse-a, .cm-lesson-pulse-b': {
    animation: 'cm-lesson-pulse 0.7s ease-out 3',
  },
  '@keyframes cm-lesson-pulse': {
    '0%, 100%': { backgroundColor: 'rgba(99, 102, 241, 0.25)' },
    '50%': { backgroundColor: 'rgba(129, 140, 248, 0.65)' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-lesson-pulse-a, .cm-lesson-pulse-b': { animation: 'none' },
  },
})

export default function CodeEditor({ code, onSave, language = 'html', onSelectionChange, highlightLines, highlightNonce, onChange, saveState, onViewReady, wrap }: CodeEditorProps) {
  const [draft, setDraft] = useState(code)
  const viewRef = useRef<EditorView | null>(null)
  const [viewReady, setViewReady] = useState(false)
  const lastEmitted = useRef(code)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    if (!highlightLines?.length) {
      view.dispatch({ effects: clearHighlight.of(null) })
      return
    }

    const doc = view.state.doc
    const validLines = highlightLines.filter((n) => n >= 1 && n <= doc.lines)
    if (!validLines.length) return

    const ranges = validLines.map((n) => {
      const line = doc.line(n)
      return { from: line.from, to: line.to }
    })
    const pulseClass = (highlightNonce ?? 0) % 2 === 0 ? 'cm-lesson-pulse-a' : 'cm-lesson-pulse-b'
    view.dispatch({
      effects: [addHighlight.of({ ranges, pulseClass }), EditorView.scrollIntoView(ranges[0].from, { y: 'center' })],
    })
    // The highlight stays until the student moves to another task. A three
    // second flash is not long enough for a child who reads slowly.
    // viewReady is a dependency because the editor is often mounted in the same
    // click that sets highlightLines (task click turns on split view).
  }, [highlightLines, highlightNonce, viewReady])

  function handleUpdate(vu: ViewUpdate) {
    // capture view ref
    if (viewRef.current !== vu.view) {
      viewRef.current = vu.view
      setViewReady(true)
      onViewReady?.(vu.view)
    }

    if (!onSelectionChange || !vu.selectionSet) return
    const sel = vu.state.selection.main
    if (sel.empty) {
      onSelectionChange(null)
      return
    }
    const text = vu.state.sliceDoc(sel.from, sel.to)
    if (!text.trim()) {
      onSelectionChange(null)
      return
    }
    const startLine = vu.state.doc.lineAt(sel.from).number
    const endLine = vu.state.doc.lineAt(sel.to).number
    onSelectionChange({ text, startLine, endLine })
  }

  const extensions = [
    highlightField,
    highlightTheme,
    ...(language === 'css' ? [css()] : language === 'js' ? [javascript()] : [html()]),
    ...(wrap ? [EditorView.lineWrapping] : []),
  ]

  const autosaving = Boolean(onChange)
  const statusLabel = saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Saving in a moment…' : 'All changes saved'

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
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={draft}
          height="100%"
          theme={mounted && resolvedTheme === 'light' ? 'light' : oneDark}
          extensions={extensions}
          onChange={handleChange}
          onUpdate={handleUpdate}
          style={{ height: '100%', fontSize: '13px' }}
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
