'use client'

import { useState } from 'react'
import type { BoardNode } from '@/lib/board/schema'
import type { CodeActions } from './Nodes'
import { SparkySpeaker } from './StepNodes'

type Sandbox = Extract<BoardNode, { type: 'sandbox' }>

// "Fill the blank, watch Sparky say it." The student sees the idea happen before
// they ever meet the editor. State lives on the node so a reload resumes.
export default function SandboxNode({ node, code }: { node: Sandbox; code?: CodeActions }) {
  const [text, setText] = useState(node.value)
  const [before, after] = node.template.split('{}')
  const [run, setRun] = useState(0) // saying the same words again replays them

  const say = (raw: string) => {
    const words = raw.trim()
    if (!words || !code) return
    setRun((n) => n + 1)
    if (!node.chips.length) setText('') // no lines to tap: the next line is typed fresh
    const seen = node.seen.includes(words) ? node.seen : [...node.seen, words]
    code.patch(node.id, { value: raw, said: words, seen, answered: seen.length >= node.need })
  }

  return (
    <div className="rounded-xl border border-[#e4d9c5] p-4 space-y-3">
      <p className="font-semibold">{node.prompt}</p>
      {node.chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {node.chips.map((chip) => {
            const tried = node.seen.includes(chip)
            return (
              <button
                key={chip}
                aria-label={`${tried ? 'Tried. ' : ''}${node.template.replace('{}', chip)}`}
                onClick={() => setText(chip)}
                className={`min-h-11 rounded-lg border-2 px-4 font-mono text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${tried ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-[#2b2118] bg-[#2b2118] text-[#f3e9d8] hover:bg-[#3b2a1c]'}`}
              >
                {tried && <span aria-hidden="true">✓ </span>}
                {node.template.replace('{}', chip)}
              </button>
            )
          })}
        </div>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          say(text)
        }}
      >
        <label className="flex min-w-0 flex-1 basis-56 items-center rounded-lg bg-[#2b2118] px-3 font-mono text-base text-[#f3e9d8]">
          <span aria-hidden="true">{before}</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={40}
            aria-label="Words for Sparky"
            placeholder="words"
            className="board-input min-h-11 min-w-0 flex-1 bg-transparent text-amber-300 outline-none placeholder:text-[#f3e9d8]/40"
          />
          <span aria-hidden="true">{after}</span>
        </label>
        <button
          disabled={!text.trim() || !code}
          className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          ▶ Say it
        </button>
      </form>
      <div className="flex justify-center rounded-xl bg-[#2b2118] p-3">
        <SparkySpeaker speak={node.said} run={run} waiting="idle" />
      </div>
      {node.need > 1 && (
        <p role="status" className="text-sm font-semibold text-[#7a4a10]">
          {node.answered
            ? 'Great! You did it.'
            : node.seen.length === 0
              ? `Click ${node.need} different lines.`
              : `Good! Click ${node.need - node.seen.length} more ${node.need - node.seen.length === 1 ? 'line' : 'lines'}. ${node.seen.length} of ${node.need} done.`}
        </p>
      )}
    </div>
  )
}
