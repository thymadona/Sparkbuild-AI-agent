'use client'

import type { TraceStep } from '@/lib/board/schema'
import { cn } from '@/lib/utils'

export interface Box {
  name: string
  value: string
  items?: string[]
}

export function Boxes({ boxes }: { boxes: Box[] }) {
  return (
    <div
      className="flex flex-wrap gap-4"
      role="img"
      aria-label={
        boxes
          .map((b) => `${b.name} holds ${b.items ? `a list of ${b.items.join(', ')}` : b.value}`)
          .join(', ') || 'no variables yet'
      }
    >
      {boxes.map((b) => (
        <div key={b.name} className="text-center">
          {b.items ? (
            <div className="flex">
              {b.items.map((it, i) => (
                <div
                  key={i}
                  className="min-w-10 border-2 border-l-0 first:border-l-2 border-amber-500 bg-amber-50 px-3 py-2 font-mono first:rounded-l-lg last:rounded-r-lg"
                >
                  {it}
                  <div className="text-[10px] text-[#7a6a52]">{i}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-w-24 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 font-mono text-lg">
              {b.value}
            </div>
          )}
          <div className="mt-1 text-sm font-mono text-[#7a6a52]">{b.name}</div>
        </div>
      ))}
    </div>
  )
}

// The stepper itself: code with the current line lit, ◀ slider ▶, the variable boxes, the call stack, what was printed.
// Shared by the tutor's trace node and the lesson's walk step.
export function TraceView({
  source,
  steps,
  at,
  go,
  note,
}: {
  source: string
  steps: TraceStep[]
  at: number
  go: (n: number) => void
  note?: string
}) {
  const last = steps.length - 1
  const step = steps[at]
  const lines = source.split('\n')
  return (
    <div className="rounded-xl border border-[#e4d9c5] p-4 space-y-3">
      <pre className="rounded-lg bg-[#2b2118] p-3 text-sm leading-6 font-mono text-[#f3e9d8] overflow-x-auto">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn('px-2 -mx-2 rounded', i + 1 === step.line && 'bg-amber-400/30')}
          >
            <span className="inline-block w-6 text-[#f3e9d8]/40 select-none">{i + 1}</span>
            {l || ' '}
          </div>
        ))}
      </pre>
      <div className="flex items-center gap-2">
        <button
          onClick={() => go(at - 1)}
          disabled={at === 0}
          aria-label="Previous step"
          className="min-h-11 min-w-11 rounded-full bg-[#e4d3b3] font-bold disabled:opacity-40"
        >
          ◀
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={at}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Step"
          className="flex-1"
        />
        <button
          onClick={() => go(at + 1)}
          disabled={at === last}
          aria-label="Next step"
          className="min-h-11 min-w-11 rounded-full bg-[#e4d3b3] font-bold disabled:opacity-40"
        >
          ▶
        </button>
        <span className="text-xs text-[#7a6a52] tabular-nums">
          {at + 1}/{steps.length}
        </span>
      </div>
      {note && <p className="board-rise text-sm font-semibold text-[#5c4f3d]">{note}</p>}
      <Boxes boxes={step.vars.map((v) => ({ name: v.name, value: v.repr, items: v.items }))} />
      {step.callStack.length > 1 && (
        <p className="text-xs font-mono text-[#7a6a52]">
          in {step.callStack.map((f) => (f === '<module>' ? 'main' : f)).join(' → ')}
        </p>
      )}
      {step.stdout && (
        <pre className="rounded-lg bg-emerald-50 p-2 text-sm font-mono text-emerald-900 whitespace-pre-wrap">
          {step.stdout}
        </pre>
      )}
    </div>
  )
}
