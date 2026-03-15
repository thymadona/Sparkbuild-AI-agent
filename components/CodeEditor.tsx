'use client'

import { useState, useEffect, useRef } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { Decoration, DecorationSet } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state'
import type { ViewUpdate } from '@codemirror/view'

interface CodeEditorProps {
  code: string
  onSave: (code: string) => void
  language?: 'html' | 'css' | 'js'
  onSelectionChange?: (selection: { text: string; startLine: number; endLine: number } | null) => void
  highlightLine?: number | null
}

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

export default function CodeEditor({ code, onSave, language = 'html', onSelectionChange, highlightLine }: CodeEditorProps) {
  const [draft, setDraft] = useState(code)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    const view = viewRef.current
    if (!view || highlightLine == null) return

    const doc = view.state.doc
    if (highlightLine < 1 || highlightLine > doc.lines) return

    const line = doc.line(highlightLine)
    view.dispatch({
      effects: [
        addHighlight.of({ from: line.from, to: line.to }),
        EditorView.scrollIntoView(line.from, { y: 'center' }),
      ],
    })

    const timer = setTimeout(() => {
      view.dispatch({ effects: clearHighlight.of(null) })
    }, 3000)

    return () => clearTimeout(timer)
  }, [highlightLine])

  function handleUpdate(vu: ViewUpdate) {
    // capture view ref
    viewRef.current = vu.view

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-gray-800 bg-gray-900 px-3 py-1.5">
        <button
          onClick={() => onSave(draft)}
          disabled={draft === code}
          className="text-xs rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={draft}
          height="100%"
          theme={oneDark}
          extensions={extensions}
          onChange={setDraft}
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
