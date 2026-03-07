'use client'

import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ViewUpdate } from '@codemirror/view'

interface CodeEditorProps {
  code: string
  onSave: (code: string) => void
  language?: 'html' | 'css' | 'js'
  onSelectionChange?: (selection: { text: string; startLine: number; endLine: number } | null) => void
}

export default function CodeEditor({ code, onSave, language = 'html', onSelectionChange }: CodeEditorProps) {
  const [draft, setDraft] = useState(code)

  function handleUpdate(vu: ViewUpdate) {
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

  const extensions = language === 'css' ? [css()] : language === 'js' ? [javascript()] : [html()]

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
