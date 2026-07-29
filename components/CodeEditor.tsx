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
  highlightLine?: number | null
  // Bumped every time the parent asks to point at a line, so asking twice for
  // the same line scrolls there again.
  highlightNonce?: number
  // Called while the student types, debounced. Drives the live preview and the
  // lesson checks.
  onChange?: (code: string) => void
  saveState?: 'saved' | 'saving' | 'dirty'
}

// Short enough that the preview feels live, long enough not to re-render on
// every keystroke.
const LIVE_DELAY_MS = 300

const addHighlight = StateEffect.define<{ from: number; to: number }>()
const clearHighlight = StateEffect.define<null>()

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(addHighlight)) {
        const mark = Decoration.line({ class: 'cm-lesson-highlight' })
        deco = Decoration.set([mark.range(e.value.from)])
      } else if (e.is(clearHighlight)) {
        deco = Decoration.none
      }
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

const highlightTheme = EditorView.baseTheme({
  '.cm-lesson-highlight': {
    backgroundColor: 'rgba(99, 102, 241, 0.25) !important',
    borderLeft: '2px solid #818cf8',
  },
})

export default function CodeEditor({ code, onSave, language = 'html', onSelectionChange, highlightLine, highlightNonce, onChange, saveState }: CodeEditorProps) {
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

    if (highlightLine == null) {
      view.dispatch({ effects: clearHighlight.of(null) })
      return
    }

    const doc = view.state.doc
    if (highlightLine < 1 || highlightLine > doc.lines) return

    const line = doc.line(highlightLine)
    view.dispatch({
      effects: [
        addHighlight.of({ from: line.from, to: line.to }),
        EditorView.scrollIntoView(line.from, { y: 'center' }),
      ],
    })
    // The highlight stays until the student moves to another task. A three
    // second flash is not long enough for a child who reads slowly.
    // viewReady is a dependency because the editor is often mounted in the same
    // click that sets highlightLine (task click turns on split view).
  }, [highlightLine, highlightNonce, viewReady])

  function handleUpdate(vu: ViewUpdate) {
    // capture view ref
    if (viewRef.current !== vu.view) {
      viewRef.current = vu.view
      setViewReady(true)
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
