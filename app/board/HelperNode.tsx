'use client'

import type { BoardNode } from '@/lib/board/schema'
import type { CodeActions } from './Nodes'

type HelperBlock = Extract<BoardNode, { type: 'helper' }>

// "Bolt wrote this": code the helper AI wrote from the student's request. Read-only — the
// student copies it into their own editor by hand. Running it tells Sparky nothing.
export default function HelperNode({ node, code }: { node: HelperBlock; code?: CodeActions }) {
  const running = code?.runningId === node.id
  return (
    <figure className="rounded-xl overflow-hidden border-2 border-sky-400 bg-sky-50">
      <figcaption className="px-3 py-2 text-sm text-sky-950">
        <span className="rounded-full bg-sky-500 px-2 py-0.5 text-xs font-bold text-white">
          ⚡ Bolt wrote this
        </span>
        <p className="mt-2 break-words">
          <span className="font-semibold">You asked:</span> {node.request}
        </p>
      </figcaption>
      <pre
        aria-label="Code Bolt wrote"
        className="bg-[#2b2118] p-4 text-sm leading-6 font-mono text-[#f3e9d8] overflow-x-auto"
      >
        {node.source.split('\n').map((line, i) => (
          <div key={i}>
            <span className="inline-block w-6 text-[#f3e9d8]/40 select-none">{i + 1}</span>
            {line || ' '}
          </div>
        ))}
      </pre>
      {code?.runHelper && (
        <div className="bg-[#2b2118] px-3 py-2">
          {running ? (
            <button
              onClick={code.stop}
              className="min-h-11 rounded-full border-2 border-red-400 px-4 text-sm font-bold text-red-300"
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={() => code.runHelper?.(node)}
              disabled={!code.ready || code.runningId !== null}
              className="min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {code.ready ? "▶ Run Bolt's code" : 'Loading Python…'}
            </button>
          )}
        </div>
      )}
    </figure>
  )
}
