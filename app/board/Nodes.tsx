'use client'

import { useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BoardNode } from '@/lib/board/schema'
import { cn } from '@/lib/utils'

type Of<T extends BoardNode['type']> = Extract<BoardNode, { type: T }>

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false, loading: () => <div className="h-40" /> })

// What the board offers a runnable code node. One Python worker is shared by the whole board.
export interface CodeActions {
  ready: boolean
  runningId: string | null
  waiting: boolean
  run(node: Of<'code'>, source: string): void
  stop(): void
  edit(id: string, source: string): void
  sendInput(text: string): void
  setCursor(id: string, cursor: number): void
}

function StaticCode({ node }: { node: Of<'code'> }) {
  return (
    <figure className="rounded-xl bg-[#2b2118] text-[#f3e9d8] overflow-hidden">
      <pre className="p-4 text-sm leading-6 font-mono overflow-x-auto">
        {node.source.split('\n').map((line, i) => (
          <div key={i} className={cn('px-2 -mx-2 rounded', node.highlightLines.includes(i + 1) && 'bg-amber-400/25')}>
            <span className="inline-block w-6 text-[#f3e9d8]/40 select-none">{i + 1}</span>
            {line || ' '}
          </div>
        ))}
      </pre>
    </figure>
  )
}

function RunnableCode({ node, code }: { node: Of<'code'>; code: CodeActions }) {
  const [answer, setAnswer] = useState('')
  const view = useRef<EditorView | null>(null) // Run must use what is typed now, not the debounced board copy
  const running = code.runningId === node.id
  const lines = Math.min(Math.max(node.source.split('\n').length, 3), 14)
  return (
    <figure className="rounded-xl overflow-hidden border border-[#3b2a1c]">
      <div style={{ height: `${lines * 20 + 36}px` }}>
        <CodeEditor
          code={node.source}
          hideToolbar
          onViewReady={(v) => { view.current = v }}
          onSave={() => {}}
          onChange={(v) => code.edit(node.id, v)}
          highlightLines={node.highlightLines}
        />
      </div>
      <div className="flex items-center gap-3 bg-[#2b2118] px-3 py-2">
        {running ? (
          <button onClick={code.stop} className="min-h-11 rounded-full border-2 border-red-400 px-4 text-sm font-bold text-red-300">■ Stop</button>
        ) : (
          <button onClick={() => code.run(node, view.current?.state.doc.toString() ?? node.source)} disabled={!code.ready || code.runningId !== null} className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white disabled:opacity-50">
            {code.ready ? '▶ Run' : 'Loading Python…'}
          </button>
        )}
        {node.caption && <figcaption className="text-xs text-[#f3e9d8]/75">{node.caption}</figcaption>}
      </div>
      {running && code.waiting && (
        <form className="flex gap-2 bg-[#2b2118] px-3 pb-3" onSubmit={(e) => { e.preventDefault(); code.sendInput(answer); setAnswer('') }}>
          <input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Answer for input()" className="min-h-11 flex-1 rounded-lg bg-[#3b2a1c] px-3 font-mono text-sm text-[#f3e9d8]" />
          <button className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-[#2b2118]">Send</button>
        </form>
      )}
    </figure>
  )
}

function CodeNode({ node, code }: { node: Of<'code'>; code?: CodeActions }) {
  return node.editable && node.language === 'python' && code ? <RunnableCode node={node} code={code} /> : <StaticCode node={node} />
}

function OutputNode({ node }: { node: Of<'output'> }) {
  const lastLine = node.stderr.trim().split('\n').at(-1) ?? ''
  return (
    <div className={cn('rounded-xl border p-3 text-sm font-mono', node.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900')}>
      <pre className="whitespace-pre-wrap">{node.stdout}{!node.stdout && !node.stderr && <span className="opacity-60">(no output)</span>}</pre>
      {node.stderr && (
        <>
          <p className="font-semibold">{lastLine}</p>
          <details className="mt-1 text-xs"><summary className="cursor-pointer">Details</summary><pre className="whitespace-pre-wrap">{node.stderr}</pre></details>
        </>
      )}
    </div>
  )
}

function QuizNode({ node }: { node: Of<'quiz'> }) {
  return (
    <div className="rounded-xl border border-[#e4d9c5] p-4">
      <p className="font-semibold mb-2">{node.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {node.options?.map((o) => (
          <span key={o} className="min-h-11 inline-flex items-center rounded-full border border-[#d9c9ab] px-4 text-sm">{o}</span>
        ))}
      </div>
    </div>
  )
}

// One box per variable, one row of cells per list. Fed by the tutor's diagram data or by a trace step.
interface Box { name: string; value: string; items?: string[] }

function Boxes({ boxes }: { boxes: Box[] }) {
  return (
    <div className="flex flex-wrap gap-4" role="img" aria-label={boxes.map((b) => `${b.name} holds ${b.items ? `a list of ${b.items.join(', ')}` : b.value}`).join(', ') || 'no variables yet'}>
      {boxes.map((b) => (
        <div key={b.name} className="text-center">
          {b.items ? (
            <div className="flex">
              {b.items.map((it, i) => (
                <div key={i} className="min-w-10 border-2 border-l-0 first:border-l-2 border-amber-500 bg-amber-50 px-3 py-2 font-mono first:rounded-l-lg last:rounded-r-lg">
                  {it}<div className="text-[10px] text-[#7a6a52]">{i}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-w-24 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 font-mono text-lg">{b.value}</div>
          )}
          <div className="mt-1 text-sm font-mono text-[#7a6a52]">{b.name}</div>
        </div>
      ))}
    </div>
  )
}

function DiagramNode({ node }: { node: Of<'diagram'> }) {
  const list = (k: string) => (Array.isArray(node.data[k]) ? (node.data[k] as Record<string, unknown>[]) : [])
  const boxes: Box[] =
    node.kind === 'variable_boxes' ? list('vars').map((v) => ({ name: String(v.name), value: String(v.value) }))
    : node.kind === 'list_boxes' ? list('lists').map((v) => ({ name: String(v.name), value: '', items: Array.isArray(v.items) ? v.items.map(String) : [] }))
    : []
  return <Boxes boxes={boxes} />
}

// Step-by-step replay of a real run: the traced line, the variables before it, what was printed so far.
function TraceNode({ node, source, code }: { node: Of<'trace'>; source: string; code?: CodeActions }) {
  const last = node.steps.length - 1
  const at = Math.min(node.cursor, Math.max(last, 0))
  const step = node.steps[at]
  if (!step) return <p className="text-sm text-[#7a6a52]">The trace has no steps.</p>
  const go = (n: number) => code?.setCursor(node.id, Math.min(Math.max(n, 0), last))
  const lines = source.split('\n')
  return (
    <div className="rounded-xl border border-[#e4d9c5] p-4 space-y-3">
      <pre className="rounded-lg bg-[#2b2118] p-3 text-sm leading-6 font-mono text-[#f3e9d8] overflow-x-auto">
        {lines.map((l, i) => (
          <div key={i} className={cn('px-2 -mx-2 rounded', i + 1 === step.line && 'bg-amber-400/30')}>
            <span className="inline-block w-6 text-[#f3e9d8]/40 select-none">{i + 1}</span>{l || ' '}
          </div>
        ))}
      </pre>
      <div className="flex items-center gap-2">
        <button onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous step" className="min-h-11 min-w-11 rounded-full bg-[#e4d3b3] font-bold disabled:opacity-40">◀</button>
        <input type="range" min={0} max={last} value={at} onChange={(e) => go(Number(e.target.value))} aria-label="Step" className="flex-1" />
        <button onClick={() => go(at + 1)} disabled={at === last} aria-label="Next step" className="min-h-11 min-w-11 rounded-full bg-[#e4d3b3] font-bold disabled:opacity-40">▶</button>
        <span className="text-xs text-[#7a6a52] tabular-nums">{at + 1}/{node.steps.length}</span>
      </div>
      <Boxes boxes={step.vars.map((v) => ({ name: v.name, value: v.repr, items: v.items }))} />
      {step.callStack.length > 1 && <p className="text-xs font-mono text-[#7a6a52]">in {step.callStack.map((f) => (f === '<module>' ? 'main' : f)).join(' → ')}</p>}
      {step.stdout && <pre className="rounded-lg bg-emerald-50 p-2 text-sm font-mono text-emerald-900 whitespace-pre-wrap">{step.stdout}</pre>}
    </div>
  )
}

export function NodeView({ node, code, sourceOf }: { node: BoardNode; code?: CodeActions; sourceOf?: (id: string) => string }) {
  switch (node.type) {
    case 'heading': return <h2 className="text-2xl font-bold">{node.text}</h2>
    case 'text': return <div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{node.markdown}</ReactMarkdown></div>
    case 'code': return <CodeNode node={node} code={code} />
    case 'output': return <OutputNode node={node} />
    case 'quiz': return <QuizNode node={node} />
    case 'diagram': return <DiagramNode node={node} />
    case 'trace': return <TraceNode node={node} source={sourceOf?.(node.forNodeId) ?? ''} code={code} />
    default: return null // preview: not built
  }
}
