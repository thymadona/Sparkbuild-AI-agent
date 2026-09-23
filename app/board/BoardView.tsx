'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BoardState } from '@/lib/board/reducer'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import Mascot, { type MascotState } from './Mascot'
import { NodeView, type CodeActions } from './Nodes'

// Sparky's captions render as markdown so a model slip like `age` becomes a
// code chip instead of literal backticks. Preflight strips <code> styling, so
// give it one explicitly against the bubble's dark background.
const captionMarkdownComponents = {
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-[#faf6ee]/20 px-1 font-mono">{children}</code>
  ),
}

// How a page reads in the rail. A lesson board has one page per task, so the
// rail is the progress bar: what is finished, what is open, what is still shut.
export type PageStatus = 'done' | 'current' | 'locked' | 'open'

// Shared by the desktop rail (vertical) and the mobile top bar (horizontal) —
// only sizing differs between them, via `className`; the locked/done/aria
// logic must stay identical, so it lives in one place.
function PageButton({
  page: p,
  index: i,
  status,
  here,
  onPick,
  className,
}: {
  page: BoardState['pages'][number]
  index: number
  status: PageStatus
  here: boolean
  onPick: () => void
  className?: string
}) {
  const locked = status === 'locked'
  return (
    <button
      onClick={() => !locked && onPick()}
      disabled={locked}
      aria-current={here ? 'page' : undefined}
      aria-label={`${locked ? 'Locked. ' : status === 'done' ? 'Done. ' : ''}Page ${i + 1}: ${p.title}`}
      title={p.title}
      className={cn(
        'grid place-items-center rounded-xl font-bold',
        here
          ? 'bg-[#2b2118] text-[#faf6ee]'
          : locked
            ? 'cursor-not-allowed border-2 border-[#d6c7a8] text-[#a89878]'
            : status === 'done'
              ? 'border-2 border-teal-600 bg-teal-50 text-teal-700 hover:bg-teal-100'
              : 'border-2 border-[#2b2118] hover:bg-[#e4d3b3]',
        className
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
}

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
  // Director lessons only: the chat box gets a Sparky / Bolt switch, and Bolt mode sends
  // the text to Bolt as a request instead of to Sparky.
  onAskBolt?: (request: string) => void
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
  onAskBolt,
}: Props) {
  const [minimized, setMinimized] = useState(false)
  const [unread, setUnread] = useState(false) // a reply arrived while Spark was hidden
  const [showEarlier, setShowEarlier] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [toBolt, setToBolt] = useState(false)
  const askBolt = toBolt && onAskBolt
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
  const latest = live || captions.at(-1) || ''
  useEffect(() => {
    if (minimized) setUnread(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest])
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
    <div className="board-root h-dvh overflow-hidden bg-[#f1e6d0] px-0 py-3 md:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[#2b2118]">
      <div className="flex h-full gap-3">
        <nav aria-label="Pages" className="hidden w-14 flex-col gap-2 overflow-y-auto pt-2 md:flex">
          <Link
            href="/lessons"
            aria-label="Back to roadmap"
            className="flex min-h-11 items-center justify-center rounded-xl bg-[#2b2118] text-[#faf6ee] hover:bg-[#3b2a1c]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {board.pages.map((p, i) => (
            <PageButton
              key={p.id}
              page={p}
              index={i}
              status={statusOf?.(p.id) ?? 'open'}
              here={p.id === page?.id}
              onPick={() => setPicked(p.id)}
              className="min-h-11 text-lg"
            />
          ))}
        </nav>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-[#fffdf8] shadow-md">
          <div className="flex shrink-0 items-center gap-2 border-b border-[#e4d9c5] px-3 py-2 md:hidden">
            <Link
              href="/lessons"
              aria-label="Back to roadmap"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#2b2118] text-[#faf6ee] hover:bg-[#3b2a1c]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex flex-1 gap-2 overflow-x-auto">
              {board.pages.map((p, i) => (
                <PageButton
                  key={p.id}
                  page={p}
                  index={i}
                  status={statusOf?.(p.id) ?? 'open'}
                  here={p.id === page?.id}
                  onPick={() => setPicked(p.id)}
                  className="size-9 shrink-0 text-sm"
                />
              ))}
            </div>
          </div>
          {progress}
          <div
            ref={paperRef}
            onScroll={onScroll}
            // md:pb-80 reserves space for Sparky's floating widget at rest on
            // desktop only (bubble capped at md:max-h-44 below + footer row +
            // mascot row) — mobile docks the widget in normal flow instead,
            // so it needs no reserve. Recompute if that cap ever changes.
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 md:px-12 py-8 md:pb-80"
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
                {!page && <p className="text-[#7a6a52]">Sparky is getting the board ready…</p>}
              </div>
              {page && footer?.(page.id)}
            </div>
          </div>

          <div
            className={cn(
              'flex flex-col gap-2',
              'shrink-0 border-t border-[#e4d9c5] px-3 py-3',
              'md:pointer-events-none md:absolute md:bottom-3 md:left-3',
              'md:max-w-[calc(100%-1.5rem)] md:items-start md:border-t-0 md:px-0 md:py-0',
              typing && 'md:w-[28rem]'
            )}
          >
            {!minimized && (
              <div className="pointer-events-auto w-full break-words rounded-2xl bg-[#3b2a1c] px-4 py-3 text-[#faf6ee] shadow-lg md:w-[18.5rem] md:max-w-full">
                {/* Capped so a long tutor reply can't push the Hide button
                    off-screen — it scrolls in place instead. Viewport-relative
                    on mobile so the docked footer itself can't outgrow a
                    short/landscape screen; fixed on desktop where the widget
                    floats and pb-80 already reserves room for it. */}
                <div className="max-h-[30vh] overflow-y-auto overscroll-contain md:max-h-44">
                  {showEarlier &&
                    captions.slice(0, -1).map((c, i) => (
                      <div key={i} className="mb-2 text-sm text-[#faf6ee]/75">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={captionMarkdownComponents}
                        >
                          {c}
                        </ReactMarkdown>
                      </div>
                    ))}
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={captionMarkdownComponents}>
                    {live || captions.at(-1) || '…'}
                  </ReactMarkdown>
                </div>
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
            {minimized && (
              <button
                type="button"
                onClick={() => {
                  setMinimized(false)
                  setUnread(false)
                }}
                className="pointer-events-auto flex w-full items-center gap-2 rounded-2xl bg-[#3b2a1c] px-4 py-2 text-left text-[#faf6ee] shadow-lg md:hidden"
              >
                <Mascot state={face} className="size-8 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {(live || captions.at(-1) || '…').replace(/[*_`~]/g, '')}
                </span>
                {unread && (
                  <span className="size-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                )}
              </button>
            )}
            <div className={cn('flex items-center gap-2', typing && 'w-full')}>
              {!typing && (
                <button
                  type="button"
                  aria-label={minimized ? 'Show Sparky' : 'Hide Sparky'}
                  onClick={() => {
                    setMinimized((v) => !v)
                    setUnread(false)
                  }}
                  className={cn(
                    'pointer-events-auto relative grid place-items-center rounded-full',
                    minimized && 'hidden md:grid'
                  )}
                >
                  <Mascot state={face} className="size-16" />
                  {unread && minimized && (
                    <span className="absolute right-1 top-1 size-4 rounded-full border-2 border-white bg-red-500" />
                  )}
                </button>
              )}
              <form
                className={cn(
                  'pointer-events-auto flex items-center gap-1 rounded-full border border-[#e4e0d6] bg-[#faf9f6] p-1 shadow-md focus-within:border-[#b45309]',
                  'flex-1',
                  // md:flex-1/md:flex-initial are mutually exclusive (a
                  // ternary, not two conditionally-combined classes) so the
                  // result doesn't depend on Tailwind's utility-ordering
                  // between two same-breakpoint classes.
                  typing ? 'md:spark-typebox md:flex-1' : 'md:flex-initial'
                )}
                onSubmit={(e) => {
                  e.preventDefault()
                  if (onSend && draft.trim() && !busy) {
                    ;(askBolt ? onAskBolt : onSend)(draft.trim())
                    setDraft('')
                    inputRef.current?.blur()
                  }
                }}
              >
                {onAskBolt && (
                  <div
                    role="group"
                    aria-label="Who to ask"
                    className="flex shrink-0 rounded-full bg-[#ece6da] p-0.5 text-xs font-bold"
                  >
                    {[false, true].map((bolt) => (
                      <button
                        key={String(bolt)}
                        type="button"
                        aria-pressed={toBolt === bolt}
                        onClick={() => setToBolt(bolt)}
                        className={cn(
                          'min-h-9 rounded-full px-2',
                          toBolt === bolt &&
                            (bolt ? 'bg-sky-500 text-white' : 'bg-[#2b2118] text-[#faf6ee]')
                        )}
                      >
                        {bolt ? '⚡ Bolt' : 'Sparky'}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  ref={inputRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') e.currentTarget.blur()
                  }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!onSend}
                  maxLength={1000}
                  placeholder={
                    askBolt
                      ? 'Tell Bolt what to build'
                      : onSend
                        ? 'Type to Sparky'
                        : 'Sparky will listen here soon…'
                  }
                  aria-label={askBolt ? 'Ask Bolt' : 'Message Sparky'}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className={cn(
                    'board-input min-h-10 min-w-0 flex-1 bg-transparent pl-3 text-base text-[#2b2118] outline-none placeholder:text-[#6b6357]',
                    !typing && 'md:w-44 md:flex-none'
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
