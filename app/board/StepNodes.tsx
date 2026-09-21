'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BoardNode } from '@/lib/board/schema'
import { cn } from '@/lib/utils'
import Mascot, { type MascotState } from './Mascot'
import type { CodeActions } from './Nodes'
import { TraceView } from './TraceView'
import NextButton from './NextButton'

type Of<T extends BoardNode['type']> = Extract<BoardNode, { type: T }>

const card = 'rounded-xl border border-[#e4d9c5] p-4 space-y-3'
const tile =
  'min-h-11 rounded-lg border-2 px-4 font-mono text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2'
const idle = 'border-[#2b2118] bg-[#2b2118] text-[#f3e9d8] hover:bg-[#3b2a1c]'
const good = 'border-teal-600 bg-teal-50 text-teal-800'
const bubble = 'board-rise rounded-2xl bg-[#3b2a1c] px-4 py-3 text-[#faf6ee]'

// What print("Hi") makes Sparky say: the words inside the quotes.
const spoken = (line: string) => line.match(/"([^"]*)"/)?.[1] ?? line

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// A code line with one part lit up. With `dim`, the rest fades: only the lit part is what Sparky says.
function Lit({ code, hl, dim }: { code: string; hl?: string; dim: boolean }) {
  const at = hl ? code.indexOf(hl) : -1
  if (at < 0 || !hl) return <>{code}</>
  const rest = dim ? 'text-[#f3e9d8]/70' : ''
  return (
    <>
      <span className={rest}>{code.slice(0, at)}</span>
      <mark className="rounded bg-amber-300 px-0.5 text-[#2b2118]">{hl}</mark>
      <span className={rest}>{code.slice(at + hl.length)}</span>
    </>
  )
}

// Sparky with a speech bubble. The words type out while his mouth moves; `run` changes to replay them.
export function SparkySpeaker({
  speak,
  run = 0,
  waiting = 'listening',
  body,
}: {
  speak: string
  run?: number
  waiting?: MascotState
  body?: string
}) {
  const [typed, setTyped] = useState(0)
  useEffect(() => {
    if (!speak) return setTyped(0)
    if (reducedMotion()) return setTyped(speak.length)
    setTyped(0)
    const t = setInterval(
      () =>
        setTyped((n) => {
          if (n + 1 >= speak.length) clearInterval(t)
          return n + 1
        }),
      110
    )
    return () => clearInterval(t)
  }, [speak, run])
  const talking = !!speak && typed < speak.length
  return (
    <div className="flex w-36 shrink-0 flex-col items-center">
      <div
        role="status"
        className="relative min-h-11 w-full break-words rounded-2xl bg-[#faf6ee] px-3 py-2 text-center text-lg font-bold text-[#2b2118]"
      >
        {speak ? (
          <>
            <span className="sr-only">Sparky says {speak}</span>
            <span aria-hidden="true">{speak.slice(0, typed)}</span>
          </>
        ) : (
          <span className="text-[#2b2118]/40">…</span>
        )}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-full size-3 -translate-x-1/2 -translate-y-1.5 rotate-45 bg-[#faf6ee]"
        />
      </div>
      <Mascot
        state={talking ? 'speaking' : speak ? 'celebrating' : waiting}
        className="mt-1 size-24"
        body={body}
      />
    </div>
  )
}

// A short stage: Sparky listens while a line of code is explained, then speaks it. Only the words come out.
export function LearnNode({ node, code }: { node: Of<'learn'>; code?: CodeActions }) {
  const last = node.frame >= node.frames.length - 1
  const f = node.frames[Math.min(node.frame, node.frames.length - 1)]
  const speak = f.speak ?? ''
  const [replay, setReplay] = useState(0)
  const next = () => code?.patch(node.id, last ? { answered: true } : { frame: node.frame + 1 })
  return (
    <div className={card}>
      <p className="font-semibold">{node.prompt}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-4 rounded-xl bg-[#2b2118] p-4">
        <pre
          key={`c${node.frame}`}
          className="board-rise overflow-x-auto font-mono text-base text-[#f3e9d8]"
        >
          <Lit code={f.code} hl={f.hl} dim={!!speak} />
        </pre>
        <SparkySpeaker speak={speak} run={replay + node.frame * 100} />
      </div>
      <p key={`n${node.frame}`} className="board-rise text-sm font-semibold text-[#5c4f3d]">
        {f.note ?? f.say}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#5c4f3d]">
          {Math.min(node.frame + 1, node.frames.length)} of {node.frames.length}
        </span>
        <div className="flex gap-2">
          {speak && (
            <button
              onClick={() => setReplay((n) => n + 1)}
              className="min-h-11 rounded-full border-2 border-[#d9c9ab] px-4 text-sm font-semibold hover:bg-[#e4d3b3]"
            >
              ↻ Again
            </button>
          )}
          {!node.answered && (
            <button
              disabled={!code}
              onClick={next}
              className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {last ? 'Got it ✓' : 'Next ▸'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const LINE_MS = 1500 // one spoken line: typing plus a beat

// Tap tiles into the answer row, then "Say it": Sparky says the lines in the order given.
// Right order (or a second miss) finishes the step; a wrong first try puzzles Sparky and clears the row.
export function OrderNode({ node, code }: { node: Of<'order'>; code?: CodeActions }) {
  const [miss, setMiss] = useState(false)
  const [play, setPlay] = useState<{
    seq: number[]
    ok: boolean
    attempts: number
  } | null>(null)
  const [at, setAt] = useState(0)
  const deck = node.lines.map((_, i) => i).reverse() // never the answer; stable across a reload
  const full = node.arranged.length === node.lines.length
  const revealed = !node.answered && node.attempts >= 2 // two misses: show the order, wait for Next
  const locked = node.answered || revealed || !code || !!play
  const place = (i: number) => {
    setMiss(false)
    code?.patch(node.id, { arranged: [...node.arranged, i] })
  }
  const remove = (i: number) => {
    setMiss(false)
    code?.patch(node.id, { arranged: node.arranged.filter((x) => x !== i) })
  }
  const say = () => {
    if (!code) return
    const ok = node.arranged.every((x, pos) => x === pos)
    const attempts = node.attempts + 1
    setMiss(false)
    setAt(0)
    setPlay({ seq: node.arranged, ok, attempts })
  }
  // Play the lines one by one, then settle the step. The patch waits so the next box opens after Sparky is done.
  useEffect(() => {
    if (!play || !code) return
    const timers = play.seq.map((_, i) => setTimeout(() => setAt(i), i * LINE_MS))
    timers.push(
      setTimeout(() => {
        setPlay(null)
        if (!play.ok)
          code.feedback?.({
            type: 'step_answer',
            nodeId: node.id,
            prompt: node.prompt,
            picked: play.seq.map((i) => node.lines[i]).join(' → '),
            attempts: play.attempts,
          })
        if (play.ok)
          code.patch(node.id, {
            attempts: play.attempts,
            answered: true,
            arranged: node.lines.map((_, i) => i),
          })
        else if (play.attempts >= 2)
          code.patch(node.id, { attempts: play.attempts, arranged: node.lines.map((_, i) => i) })
        else {
          setMiss(true)
          code.patch(node.id, { attempts: play.attempts, arranged: [] })
        }
      }, play.seq.length * LINE_MS)
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new play restarts it
  }, [play])
  const speak = play ? spoken(node.lines[play.seq[at]]) : ''
  return (
    <div className={card}>
      <p className="font-semibold">{node.prompt}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-start gap-4">
        <div className="space-y-3">
          <div
            className="flex min-h-11 flex-wrap gap-2 rounded-lg border-2 border-dashed border-[#d9c9ab] p-2"
            role="group"
            aria-label="Your order"
          >
            {node.arranged.map((i, pos) => (
              <button
                key={i}
                disabled={locked}
                onClick={() => remove(i)}
                aria-label={`${pos + 1}. ${node.lines[i]}`}
                className={cn(tile, node.answered || revealed ? good : idle)}
              >
                {pos + 1}. {node.lines[i]}
              </button>
            ))}
            {node.arranged.length === 0 && (
              <span className="self-center px-2 text-sm text-[#5c4f3d]">
                Tap lines to put them here.
              </span>
            )}
          </div>
          {!node.answered && !revealed && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Lines">
              {deck
                .filter((i) => !node.arranged.includes(i))
                .map((i) => (
                  <button
                    key={i}
                    disabled={locked}
                    onClick={() => place(i)}
                    className={cn(
                      tile,
                      'border-[#d9c9ab] bg-white text-[#2b2118] hover:bg-[#e4d3b3]'
                    )}
                  >
                    {node.lines[i]}
                  </button>
                ))}
            </div>
          )}
          {revealed && <NextButton onClick={() => code?.patch(node.id, { answered: true })} />}
          {!node.answered && !revealed && (
            <button
              disabled={locked || !full}
              onClick={say}
              className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              ▶ Say it
            </button>
          )}
          {!node.answered && !revealed && !full && (
            <p className="text-xs text-[#5c4f3d]">Use all {node.lines.length} lines first.</p>
          )}
          <p aria-live="polite" className="min-h-6 text-sm">
            {node.answered ? (
              <span className="text-teal-800">Sparky said them in order!</span>
            ) : revealed ? (
              <span className="text-[#5c4f3d]">Here is the order.</span>
            ) : miss ? (
              <span className="text-red-800">Not quite. Try again.</span>
            ) : null}
          </p>
        </div>
        <div className="rounded-xl bg-[#2b2118] p-2">
          <SparkySpeaker
            speak={speak}
            run={at}
            waiting={node.answered ? 'celebrating' : miss ? 'puzzled' : 'listening'}
          />
        </div>
      </div>
    </div>
  )
}

// Tap the line with the mistake. Two misses reveal it; Next moves on.
// Step through a short program: the same stepper as a trace, fed by authored frames. Done on the last frame.
export function WalkNode({ node, code }: { node: Of<'walk'>; code?: CodeActions }) {
  const last = node.frames.length - 1
  const at = Math.min(node.cursor, last)
  const steps = node.frames.map((f) => ({
    line: f.line,
    stdout: f.out ?? '',
    callStack: f.stack ?? [],
    vars: Object.entries(f.vars).map(([name, v]) =>
      Array.isArray(v) ? { name, type: 'list', repr: '', items: v } : { name, type: '', repr: v }
    ),
  }))
  const go = (n: number) => {
    const to = Math.min(Math.max(n, 0), last)
    code?.patch(node.id, to === last ? { cursor: to, answered: true } : { cursor: to })
  }
  return (
    <div className={card}>
      <p className="font-semibold">{node.prompt}</p>
      <TraceView source={node.code} steps={steps} at={at} go={go} note={node.frames[at].note} />
      <p aria-live="polite" className="min-h-6 text-sm text-[#5c4f3d]">
        {node.answered
          ? 'You walked through it ✓'
          : `Reach the last step (${at + 1} of ${last + 1}).`}
      </p>
    </div>
  )
}

export function BugNode({ node, code }: { node: Of<'bug'>; code?: CodeActions }) {
  const lines = node.code.split('\n')
  const picked = node.picked ?? null
  const revealed = !node.answered && node.attempts >= 2 // two misses: show the line, wait for Next
  const pick = (i: number) => {
    if (!code || node.answered || revealed) return
    const attempts = node.attempts + 1
    code.patch(node.id, { picked: i, attempts, answered: i === node.bugLine })
    if (i !== node.bugLine)
      code.feedback?.({
        type: 'step_answer',
        nodeId: node.id,
        prompt: node.prompt,
        picked: lines[i],
        attempts,
      })
  }
  return (
    <div className={card}>
      <p className="font-semibold">{node.prompt}</p>
      <div className="space-y-1 rounded-lg bg-[#2b2118] p-2" role="group" aria-label={node.prompt}>
        {lines.map((l, i) => {
          const isBug = i === node.bugLine
          const shown =
            (node.answered || revealed) && isBug
              ? picked === i
                ? 'good'
                : 'bad'
              : picked === i && !node.answered && !revealed
                ? 'bad'
                : null
          return (
            <button
              key={i}
              disabled={!code || node.answered || revealed}
              onClick={() => pick(i)}
              className={cn(
                'block min-h-11 w-full rounded-md px-3 text-left font-mono text-sm focus-visible:outline-2',
                shown === 'good'
                  ? 'bg-teal-100 text-teal-900'
                  : shown === 'bad'
                    ? 'bg-red-100 text-red-900'
                    : 'text-[#f3e9d8] hover:bg-[#3b2a1c] disabled:hover:bg-transparent'
              )}
            >
              {shown === 'good' && <span aria-hidden="true">✓ </span>}
              {shown === 'bad' && (node.answered || revealed) && (
                <span aria-hidden="true">🐞 </span>
              )}
              {l}
            </button>
          )
        })}
      </div>
      <p role="status" className="min-h-6 text-sm">
        {node.answered || revealed ? (
          <span className={picked === node.bugLine ? 'text-teal-800' : 'text-[#5c4f3d]'}>
            {picked === node.bugLine ? 'Found it! ' : 'Here it is: '}
            {node.explain}
          </span>
        ) : picked !== null ? (
          <span className="text-red-800">Not that one. Try again.</span>
        ) : null}
      </p>
      {revealed && <NextButton onClick={() => code?.patch(node.id, { answered: true })} />}
    </div>
  )
}

// One color per matched pair, so crossing lines stay easy to tell apart. Whole class strings for Tailwind.
const PAIR_COLORS = [
  { stroke: 'stroke-sky-500', box: 'border-sky-500 bg-sky-50 text-sky-900' },
  { stroke: 'stroke-fuchsia-500', box: 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900' },
  { stroke: 'stroke-orange-500', box: 'border-orange-500 bg-orange-50 text-orange-900' },
  { stroke: 'stroke-lime-600', box: 'border-lime-600 bg-lime-50 text-lime-900' },
]

// Tap a code piece, then what it does. A line joins each matched pair; wrong pairs just bounce back.
export function MatchNode({ node, code }: { node: Of<'match'>; code?: CodeActions }) {
  const [miss, setMiss] = useState(false)
  const [tick, setTick] = useState(0) // bump to re-measure the lines
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const lefts = useRef<(HTMLButtonElement | null)[]>([])
  const rights = useRef<(HTMLButtonElement | null)[]>([])
  const picked = node.picked ?? null
  const order = node.pairs.map((_, i) => i).reverse()
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setTick((t) => t + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // offsetParent of every button is `box` (the only positioned ancestor).
  const anchor = (b: HTMLButtonElement | null, side: 'l' | 'r') =>
    b && {
      x: side === 'r' ? b.offsetLeft + b.offsetWidth : b.offsetLeft,
      y: b.offsetTop + b.offsetHeight / 2,
    }
  const [lines, setLines] = useState<
    {
      key: string
      a: { x: number; y: number }
      b: { x: number; y: number }
      done: boolean
      color?: string
    }[]
  >([])
  useLayoutEffect(() => {
    const out: typeof lines = []
    for (const j of node.matched) {
      const a = anchor(lefts.current[j], 'r'),
        b = anchor(rights.current[j], 'l')
      if (a && b) out.push({ key: `m${j}`, a, b, done: true, color: PAIR_COLORS[j].stroke })
    }
    if (picked !== null && !node.answered) {
      const a = anchor(lefts.current[picked], 'r')
      if (a) out.push({ key: 'pick', a, b: pointer ?? { x: a.x + 24, y: a.y }, done: false })
    }
    setLines(out)
  }, [node.matched, picked, node.answered, pointer, tick])
  const tapLeft = (i: number) => {
    setMiss(false)
    code?.patch(node.id, { picked: picked === i ? null : i })
  }
  const tapRight = (j: number) => {
    if (!code || picked === null) return
    if (picked === j) {
      const matched = [...node.matched, j]
      setPointer(null)
      code.patch(node.id, { matched, picked: null, answered: matched.length === node.pairs.length })
    } else {
      setMiss(true)
      setPointer(null)
      code.patch(node.id, { picked: null, attempts: node.attempts + 1 })
      code.feedback?.({
        type: 'step_answer',
        nodeId: node.id,
        prompt: node.prompt,
        picked: `${node.pairs[picked].left} = ${node.pairs[j].right}`,
        attempts: node.attempts + 1,
      })
    }
  }
  const locked = !code || node.answered
  return (
    <div className={card}>
      <p className="font-semibold">{node.prompt}</p>
      <div
        ref={box}
        className="relative grid grid-cols-2 gap-x-16 sm:gap-x-24"
        onPointerMove={(e) => {
          if (picked !== null) {
            const r = e.currentTarget.getBoundingClientRect()
            setPointer({ x: e.clientX - r.left, y: e.clientY - r.top })
          }
        }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {lines.map((l) => (
            <line
              key={l.key}
              x1={l.a.x}
              y1={l.a.y}
              x2={l.b.x}
              y2={l.b.y}
              strokeWidth={3}
              strokeLinecap="round"
              className={l.color ?? 'stroke-amber-500'}
              strokeDasharray={l.done ? undefined : '6 6'}
            />
          ))}
        </svg>
        <div className="flex flex-col gap-2" role="group" aria-label="Code">
          {node.pairs.map((p, i) => (
            <button
              key={i}
              ref={(el) => {
                lefts.current[i] = el
              }}
              disabled={locked || node.matched.includes(i)}
              aria-pressed={picked === i}
              onClick={() => tapLeft(i)}
              className={cn(
                tile,
                node.matched.includes(i)
                  ? PAIR_COLORS[i].box
                  : picked === i
                    ? 'border-amber-500 bg-amber-100 text-[#2b2118]'
                    : idle
              )}
            >
              {p.left}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2" role="group" aria-label="What it does">
          {order.map((j) => (
            <button
              key={j}
              ref={(el) => {
                rights.current[j] = el
              }}
              disabled={locked || node.matched.includes(j) || picked === null}
              onClick={() => tapRight(j)}
              className={cn(
                'min-h-11 rounded-lg border-2 px-3 text-sm font-semibold focus-visible:outline-2',
                node.matched.includes(j)
                  ? PAIR_COLORS[j].box
                  : 'border-[#d9c9ab] hover:bg-[#e4d3b3] disabled:hover:bg-transparent'
              )}
            >
              {node.matched.includes(j) && <span aria-hidden="true">✓ </span>}
              {node.pairs[j].right}
            </button>
          ))}
        </div>
      </div>
      <p role="status" className="min-h-6 text-sm">
        {node.answered ? (
          <span className="text-teal-800">All matched!</span>
        ) : miss ? (
          <span className="text-red-800">Not a match. Try again.</span>
        ) : picked !== null ? (
          <span className="text-[#5c4f3d]">Now tap what it does.</span>
        ) : null}
      </p>
    </div>
  )
}
