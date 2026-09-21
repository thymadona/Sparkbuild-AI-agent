'use client'

import { useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BoardNode } from '@/lib/board/schema'
import type { ClientEvent } from '@/lib/tutor/events'
import { blockOf } from '@/lib/board/code'
import { cn } from '@/lib/utils'
import QuizNode from './QuizNode'
import SandboxNode from './SandboxNode'
import { Boxes, TraceView, type Box } from './TraceView'
import { BugNode, LearnNode, MatchNode, OrderNode, WalkNode } from './StepNodes'
import StageNode from './StageNode'

type Of<T extends BoardNode['type']> = Extract<BoardNode, { type: T }>

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), {
  ssr: false,
  loading: () => <div className="h-40" />,
})

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
  // Records what the student did on a lesson step (picked, seen, ...).
  patch(id: string, patch: Record<string, unknown>): void
  // Tells the tutor about a wrong pick or a missed goal so Sparky can react.
  feedback?(event: Extract<ClientEvent, { type: 'step_answer' | 'stage_result' }>): void
}

function StaticCode({ node }: { node: Of<'code'> }) {
  return (
    <figure className="rounded-xl bg-[#2b2118] text-[#f3e9d8] overflow-hidden">
      <pre className="p-4 text-sm leading-6 font-mono overflow-x-auto">
        {node.source.split('\n').map((line, i) => (
          <div key={i} className="px-2 -mx-2 rounded">
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
  // The editor shows this task's block; the node keeps, runs and saves the whole file.
  const region = blockOf(node.source, node.anchor)
  const count = region.block.split('\n').length
  const lines = Math.min(Math.max(count, 3), 14)
  return (
    <figure className="rounded-xl overflow-hidden border border-[#3b2a1c]">
      <div style={{ height: `${lines * 20 + 36}px` }}>
        <CodeEditor
          code={region.block}
          hideToolbar
          onViewReady={(v) => {
            view.current = v
          }}
          onSave={() => {}}
          onChange={(v) => code.edit(node.id, region.compose(v))}
        />
      </div>
      <div className="flex items-center gap-3 bg-[#2b2118] px-3 py-2">
        {running ? (
          <button
            onClick={code.stop}
            className="min-h-11 rounded-full border-2 border-red-400 px-4 text-sm font-bold text-red-300"
          >
            ■ Stop
          </button>
        ) : (
          <button
            onClick={() =>
              code.run(node, region.compose(view.current?.state.doc.toString() ?? region.block))
            }
            disabled={!code.ready || code.runningId !== null}
            className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {code.ready ? '▶ Run' : 'Loading Python…'}
          </button>
        )}
        {node.caption && (
          <figcaption className="text-xs text-[#f3e9d8]/75">{node.caption}</figcaption>
        )}
      </div>
      {running && code.waiting && (
        <form
          className="flex gap-2 bg-[#2b2118] px-3 pb-3"
          onSubmit={(e) => {
            e.preventDefault()
            code.sendInput(answer)
            setAnswer('')
          }}
        >
          <input
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Answer for input()"
            className="min-h-11 flex-1 rounded-lg bg-[#3b2a1c] px-3 font-mono text-sm text-[#f3e9d8]"
          />
          <button className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-[#2b2118]">
            Send
          </button>
        </form>
      )}
    </figure>
  )
}

function CodeNode({ node, code }: { node: Of<'code'>; code?: CodeActions }) {
  return node.editable && node.language === 'python' && code ? (
    <RunnableCode node={node} code={code} />
  ) : (
    <StaticCode node={node} />
  )
}

// One plain sentence per common Python error, so it reads well even when Spark is hidden.
const FRIENDLY: [RegExp, string][] = [
  [/was never closed/, 'A bracket ( opened but never closed ).'],
  [/unterminated string|EOL while scanning/, 'A quote " opened but never closed.'],
  [/NameError/, 'Python does not know that name. Check the spelling.'],
  [/IndentationError/, 'A line has the wrong space at the start.'],
  [/SyntaxError/, 'Python cannot read this line. Check the marks: ( ) " :'],
  [/TypeError/, 'These two values cannot be used together.'],
  [/ZeroDivisionError/, 'You cannot divide by zero.'],
  [/IndexError/, 'That list slot does not exist.'],
]

function OutputNode({ node }: { node: Of<'output'> }) {
  const lastLine = node.stderr.trim().split('\n').at(-1) ?? ''
  return (
    <div
      className={cn(
        'rounded-xl border p-3 text-sm font-mono',
        node.ok
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : 'border-red-300 bg-red-50 text-red-900'
      )}
    >
      <pre className="whitespace-pre-wrap">
        {node.stdout}
        {!node.stdout && !node.stderr && <span className="opacity-60">(no output)</span>}
      </pre>
      {node.stderr && (
        <>
          <p className="font-semibold">{lastLine}</p>
          {FRIENDLY.find(([re]) => re.test(node.stderr)) && (
            <p className="text-sm">{FRIENDLY.find(([re]) => re.test(node.stderr))![1]}</p>
          )}
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer">Details</summary>
            <pre className="whitespace-pre-wrap">{node.stderr}</pre>
          </details>
        </>
      )}
    </div>
  )
}

// One box per variable, one row of cells per list. Fed by the tutor's diagram data or by a trace step.

function DiagramNode({ node }: { node: Of<'diagram'> }) {
  const list = (k: string) =>
    Array.isArray(node.data[k]) ? (node.data[k] as Record<string, unknown>[]) : []
  const boxes: Box[] =
    node.kind === 'variable_boxes'
      ? list('vars').map((v) => ({ name: String(v.name), value: String(v.value) }))
      : node.kind === 'list_boxes'
        ? list('lists').map((v) => ({
            name: String(v.name),
            value: '',
            items: Array.isArray(v.items) ? v.items.map(String) : [],
          }))
        : []
  return <Boxes boxes={boxes} />
}

// Step-by-step replay of a real run: the traced line, the variables before it, what was printed so far.
function TraceNode({
  node,
  source,
  code,
}: {
  node: Of<'trace'>
  source: string
  code?: CodeActions
}) {
  const last = node.steps.length - 1
  const at = Math.min(node.cursor, Math.max(last, 0))
  if (!node.steps[at]) return <p className="text-sm text-[#7a6a52]">The trace has no steps.</p>
  return (
    <TraceView
      source={source}
      steps={node.steps}
      at={at}
      go={(n) => code?.setCursor(node.id, Math.min(Math.max(n, 0), last))}
    />
  )
}

export function NodeView({
  node,
  code,
  sourceOf,
}: {
  node: BoardNode
  code?: CodeActions
  sourceOf?: (id: string) => string
}) {
  switch (node.type) {
    case 'heading':
      return <h2 className="text-2xl font-bold">{node.text}</h2>
    case 'text':
      return (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.markdown}</ReactMarkdown>
        </div>
      )
    case 'code':
      return <CodeNode node={node} code={code} />
    case 'output':
      return <OutputNode node={node} />
    case 'quiz':
      return <QuizNode node={node} code={code} />
    case 'sandbox':
      return <SandboxNode node={node} code={code} />
    case 'learn':
      return <LearnNode node={node} code={code} />
    case 'order':
      return <OrderNode node={node} code={code} />
    case 'walk':
      return <WalkNode node={node} code={code} />
    case 'bug':
      return <BugNode node={node} code={code} />
    case 'match':
      return <MatchNode node={node} code={code} />
    case 'stage':
      return <StageNode node={node} code={code} />
    case 'diagram':
      return <DiagramNode node={node} />
    case 'trace':
      return <TraceNode node={node} source={sourceOf?.(node.forNodeId) ?? ''} code={code} />
    default:
      return null // preview: not built
  }
}
