'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BoardState } from '@/lib/board/reducer'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import Mascot, { type MascotState } from './Mascot'
import { NodeView, type CodeActions } from './Nodes'

// How a page reads in the rail. A lesson board has one page per task, so the
// rail is the progress bar: what is finished, what is open, what is still shut.
export type PageStatus = 'done' | 'current' | 'locked' | 'open'

interface Props {
  board: BoardState
  captions: string[]
  live: string
  mascot: MascotState
  mood?: MascotState | null // brief reaction, e.g. a run passed or failed
  code?: CodeActions
  onReplay?: () => void // demo only
  onSend?: (text: string) => void // live only
  busy?: boolean
  // Rendered above the page's nodes: on a lesson board, the task this page is
  // for and what is still missing from it.
  header?: (pageId: string) => ReactNode
  footer?: (pageId: string) => ReactNode
  // Sticky strip above the page (lesson progress and XP).
  progress?: ReactNode
  statusOf?: (pageId: string) => PageStatus
  // Which page the student is actually looking at. On a lesson board that is
  // the task they are working on, so the owner needs to know.
  onViewPage?: (pageId: string) => void
  // Sparky's voice toggle. `voice` undefined = this browser cannot speak, so no toggle.
  voice?: boolean
  onVoice?: () => void
}

export default function BoardView({
  board,
  captions,
  live,
  mascot,
  mood,
  code,
  onReplay,
  onSend,
  busy,
  header,
  footer,
  progress,
  statusOf,
  onViewPage,
  voice,
  onVoice,
}: Props) {
  const [minimized, setMinimized] = useState(false)
  const [showEarlier, setShowEarlier] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [quiet, setQuiet] = useState(false)
  const [focused, setFocused] = useState(false)
  const typing = focused // input takes the row on the right; Spark steps aside, and returns on blur
  const inputRef = useRef<HTMLInputElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true) // false once the student scrolls up
  // Student silent for 20s: Spark looks puzzled until anything happens again.
  useEffect(() => {
    setQuiet(false)
    const t = setTimeout(() => setQuiet(true), 20_000)
    return () => clearTimeout(t)
  }, [draft, mascot, mood, board])
  const face: MascotState =
    mood ?? (mascot !== 'idle' ? mascot : draft ? 'listening' : quiet ? 'puzzled' : 'idle')
  const behavior = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

  // Follow the tutor to a new page unless the student picked one.
  const page =
    board.pages.find((p) => p.id === picked) ?? board.pages.find((p) => p.id === board.activePageId)
  useEffect(() => {
    setPicked(null)
  }, [board.activePageId])

  const pageId = page?.id
  useEffect(() => {
    if (pageId) onViewPage?.(pageId)
  }, [pageId, onViewPage])

  const nodeCount = page?.nodeIds.length ?? 0
  useEffect(() => {
    const el = paperRef.current
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: behavior() })
  }, [nodeCount, page?.id])
  useEffect(() => {
    if (board.focusId)
      document
        .getElementById(`node-${board.focusId}`)
        ?.scrollIntoView({ block: 'center', behavior: behavior() })
  }, [board.focusId])

  const onScroll = useCallback(() => {
    const el = paperRef.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  return (
    <div className="board-root h-dvh overflow-hidden bg-[#f1e6d0] p-3 md:p-4 text-[#2b2118]">
      <div className="flex h-full gap-3">
        <nav aria-label="Pages" className="flex w-14 flex-col gap-2 pt-2">
          <Link
            href="/lessons"
            aria-label="Back to roadmap"
            className="flex min-h-11 items-center justify-center rounded-xl bg-[#2b2118] text-[#faf6ee] hover:bg-[#3b2a1c]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {board.pages.map((p, i) => {
            const status = statusOf?.(p.id) ?? 'open'
            const locked = status === 'locked'
            const here = p.id === page?.id
            return (
              <button
                key={p.id}
                onClick={() => !locked && setPicked(p.id)}
                disabled={locked}
                aria-current={here ? 'page' : undefined}
                aria-label={`${locked ? 'Locked. ' : status === 'done' ? 'Done. ' : ''}Page ${i + 1}: ${p.title}`}
                title={p.title}
                className={cn(
                  'grid min-h-11 place-items-center rounded-xl text-lg font-bold',
                  here
                    ? 'bg-[#2b2118] text-[#faf6ee]'
                    : locked
                      ? 'cursor-not-allowed border-2 border-[#d6c7a8] text-[#a89878]'
                      : status === 'done'
                        ? 'border-2 border-teal-600 bg-teal-50 text-teal-700 hover:bg-teal-100'
                        : 'border-2 border-[#2b2118] hover:bg-[#e4d3b3]'
                )}
              >
                {locked ? (
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden="true"
                  >
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V7a4 4 0 018 0v3" />
                  </svg>
                ) : status === 'done' && !here ? (
                  '✓'
                ) : (
                  i + 1
                )}
              </button>
            )
          })}
        </nav>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-[#fffdf8] shadow-md">
          {progress}
          <div
            ref={paperRef}
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto px-6 md:px-12 py-8 pb-32"
          >
            <div className="mx-auto max-w-2xl">
              {page && header?.(page.id)}
              <div className="space-y-5">
                {page?.nodeIds.map((id) => (
                  <div
                    key={id}
                    id={`node-${id}`}
                    className={cn(
                      board.nodes[id].createdBy === 'system' ? 'board-enter' : 'board-rise',
                      'rounded-xl',
                      board.focusId === id && 'board-pulse'
                    )}
                  >
                    <NodeView
                      node={board.nodes[id]}
                      code={code}
                      sourceOf={(n) => {
                        const c = board.nodes[n]
                        return c?.type === 'code' ? c.source : ''
                      }}
                    />
                  </div>
                ))}
                {!page && <p className="text-[#7a6a52]">Spark is getting the board ready…</p>}
              </div>
              {page && footer?.(page.id)}
            </div>
          </div>

          <div
            className={cn(
              'pointer-events-none absolute bottom-3 flex max-w-[calc(100%-1.5rem)] flex-col gap-2',
              'left-3 items-start',
              typing && 'w-[28rem]'
            )}
          >
            {!minimized && (
              <div className="pointer-events-auto max-h-40 w-72 max-w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl bg-[#3b2a1c] px-4 py-3 text-[#faf6ee] shadow-lg">
                {showEarlier &&
                  captions.slice(0, -1).map((c, i) => (
                    <p key={i} className="mb-2 text-sm text-[#faf6ee]/75">
                      {c}
                    </p>
                  ))}
                <p>{live || captions.at(-1) || '…'}</p>
                <div className="mt-1 flex gap-3 text-xs text-[#faf6ee]/80">
                  {captions.length > 1 && (
                    <button
                      className="min-h-6 hover:underline focus-visible:underline"
                      onClick={() => setShowEarlier((v) => !v)}
                    >
                      {showEarlier ? 'Hide' : 'Show'} earlier
                    </button>
                  )}
                  <button
                    className="min-h-6 hover:underline focus-visible:underline"
                    onClick={() => setMinimized(true)}
                  >
                    Hide
                  </button>
                  {voice !== undefined && (
                    <button
                      className="min-h-6 hover:underline focus-visible:underline"
                      aria-pressed={voice}
                      onClick={onVoice}
                    >
                      {voice ? '🔊 Voice on' : '🔈 Voice off'}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className={cn('flex items-center gap-2', typing && 'w-full')}>
              {!typing && (
                <button
                  type="button"
                  aria-label={minimized ? 'Show Spark' : 'Hide Spark'}
                  onClick={() => setMinimized((v) => !v)}
                  className="pointer-events-auto grid place-items-center rounded-full"
                >
                  <Mascot state={face} className="size-16" />
                </button>
              )}
              <form
                className={cn(
                  'pointer-events-auto flex items-center gap-1 rounded-full border border-[#e4e0d6] bg-[#faf9f6] p-1 shadow-md focus-within:border-[#b45309]',
                  typing && 'spark-typebox flex-1'
                )}
                onSubmit={(e) => {
                  e.preventDefault()
                  if (onSend && draft.trim() && !busy) {
                    onSend(draft.trim())
                    setDraft('')
                    inputRef.current?.blur()
                  }
                }}
              >
                <input
                  ref={inputRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') e.currentTarget.blur()
                  }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!onSend}
                  maxLength={1000}
                  placeholder={onSend ? 'Type to Spark' : 'Spark will listen here soon…'}
                  aria-label="Message Spark"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className={cn(
                    'board-input min-h-10 min-w-0 bg-transparent pl-3 text-base text-[#2b2118] outline-none placeholder:text-[#6b6357]',
                    typing ? 'flex-1' : 'w-44'
                  )}
                />
                {onReplay ? (
                  <button
                    type="button"
                    onClick={onReplay}
                    className="min-h-10 rounded-full bg-amber-500 px-4 text-sm font-semibold text-[#2b2118]"
                  >
                    Replay
                  </button>
                ) : (
                  <button
                    disabled={busy || !draft.trim()}
                    aria-label="Send"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-[#2b2118] text-[#faf6ee] transition-colors disabled:bg-[#a29a8f]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                )}
              </form>
            </div>
          </div>
        </main>
      </div>
      <span className="sr-only" role="status">
        {live}
      </span>
    </div>
  )
}
