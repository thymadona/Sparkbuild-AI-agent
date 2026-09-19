'use client'

import { useEffect, useRef, useState } from 'react'
import { usePythonRunner } from '@/hooks/usePythonRunner'
import SparkyWorld, { type Scene } from '@/components/SparkyWorld'

interface Props {
  files: Record<string, string>
  entry: string
  // Lessons with a world show Sparky above the output.
  scene?: Scene
}

const KIND_CLASS = {
  out: 'text-fg-primary',
  in: 'text-brand-500',
  err: 'text-red-500',
  note: 'text-amber-500',
} as const

export default function PythonRunner({ files, entry, scene }: Props) {
  const { output, status, run, stop, sendInput, isolated, world } = usePythonRunner()
  const [answer, setAnswer] = useState('')
  const [inputsText, setInputsText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [output, status])

  const busy = status === 'running' || status === 'waiting'

  return (
    <div className="flex h-full flex-col bg-surface-900 font-mono text-sm">
      <div className="flex items-center gap-2 border-b border-surface-600 px-3 py-2 shrink-0">
        {busy ? (
          <button onClick={stop} className="rounded-md border-2 border-red-500 px-3 py-1 text-xs font-bold text-red-500">
            ■ Stop
          </button>
        ) : (
          <button
            onClick={() => run(files, entry, isolated ? [] : inputsText.split('\n'))}
            disabled={status === 'loading' || status === 'failed'}
            className="rounded-md border-2 border-brand-500 bg-brand-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
          >
            {status === 'loading' ? 'Loading Python…' : status === 'failed' ? 'Python unavailable' : '▶ Run'}
          </button>
        )}
        <span className="text-xs text-fg-muted">{entry}</span>
      </div>

      {scene && <SparkyWorld scene={scene} events={world.events} runId={world.runId} />}

      {!isolated && (
        <textarea
          value={inputsText}
          onChange={(e) => setInputsText(e.target.value)}
          placeholder="Answers for input(), one per line"
          rows={2}
          className="border-b border-surface-600 bg-surface-800 px-3 py-1 text-xs text-fg-primary"
        />
      )}

      <div className="min-h-[5rem] flex-1 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2">
        {output.length === 0 && status !== 'loading' && !busy && (
          <span className="text-fg-muted">Press Run to see what your code does.</span>
        )}
        {output.map((c, i) => <span key={i} className={KIND_CLASS[c.kind]}>{c.kind === 'note' ? `\n${c.text}\n` : c.text}</span>)}
        {status === 'waiting' && (
          <form
            className="inline"
            onSubmit={(e) => { e.preventDefault(); sendInput(answer); setAnswer('') }}
          >
            <input
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-40 border-b border-brand-500 bg-transparent text-brand-500 outline-none"
              aria-label="Type your answer and press Enter"
            />
          </form>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
