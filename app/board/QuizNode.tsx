'use client'

import type { BoardNode } from '@/lib/board/schema'
import { cn } from '@/lib/utils'
import type { CodeActions } from './Nodes'

export default function QuizNode({ node, code }: { node: Extract<BoardNode, { type: 'quiz' }>; code?: CodeActions }) {
  // A scripted step has an `answer` and can be graded here. A tutor quiz has none, or no board to write to: read-only.
  const graded = node.answer !== undefined && !!code
  const picked = node.picked ?? null
  const right = picked !== null && picked === node.answer
  const pick = (i: number) => {
    if (!graded || node.answered) return
    const attempts = node.attempts + 1
    const ok = i === node.answer
    code.patch(node.id, { picked: i, attempts, answered: ok || attempts >= 2 })
    if (!ok) code.feedback?.({ type: 'step_answer', nodeId: node.id, prompt: node.prompt, picked: node.options?.[i] ?? '', attempts })
  }
  return (
    <div className="rounded-xl border border-[#e4d9c5] p-4 space-y-3">
      <p className="font-semibold">{node.prompt}</p>
      {node.code && <pre className="rounded-lg bg-[#2b2118] p-3 font-mono text-sm text-[#f3e9d8] overflow-x-auto">{node.code}</pre>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={node.prompt}>
        {node.options?.map((o, i) => {
          const shown = node.answered && node.answer === i ? 'right' : picked === i && !right && !node.answered ? 'wrong' : picked === i && right ? 'right' : null
          return (
            <button
              key={o}
              disabled={!graded || node.answered}
              onClick={() => pick(i)}
              className={cn(
                'min-h-11 rounded-full border-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2',
                shown === 'right' ? 'border-teal-600 bg-teal-50 text-teal-800' : shown === 'wrong' ? 'border-red-400 bg-red-50 text-red-800' : 'border-[#d9c9ab] hover:bg-[#e4d3b3] disabled:hover:bg-transparent',
              )}
            >
              {shown === 'right' && <span aria-hidden="true">✓ </span>}{o}
            </button>
          )
        })}
      </div>
      <p role="status" className="min-h-6 text-sm">
        {node.answered && node.explain ? <span className={right ? 'text-teal-800' : 'text-[#5c4f3d]'}>{right ? 'Yes! ' : 'Here it is: '}{node.explain}</span> : picked !== null && !right ? <span className="text-red-800">Not quite. Try again.</span> : null}
      </p>
    </div>
  )
}
