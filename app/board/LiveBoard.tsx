'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { boardReducer, type BoardState } from '@/lib/board/reducer'
import { runOps, traceOps } from '@/lib/board/run'
import { usePythonRunner } from '@/hooks/usePythonRunner'
import { boardCode, codeNodeId, withBoardCode } from '@/lib/board/code'
import { useLessonProgress } from '@/hooks/useLessonProgress'
import { RuntimeChecksContext, useRuntimeChecks } from '@/hooks/useRuntimeChecks'
import { PanelLeft } from 'lucide-react'
import Navigator from '@/components/Navigator'
import ConfettiBurst from '@/components/ConfettiBurst'
import type { Lesson } from '@/lib/lessons'
import type { ClassSlot } from '@/lib/schedule'
import type { SubmissionStatus } from '@/types'
import BoardView from './BoardView'
import type { MascotState } from './Mascot'
import type { CodeActions } from './Nodes'
import { useTutor } from './useTutor'

interface Props {
  projectId: string
  initialBoard: BoardState
  lastCaption: string | null
  lesson: Lesson | null
  entry: string
  files: Record<string, string>
  completedTaskIds: string[]
  submission: SubmissionStatus | null
  classSlots: ClassSlot[]
}

export default function LiveBoard({ projectId, initialBoard, lastCaption, lesson, entry, files, completedTaskIds, submission, classSlots }: Props) {
  const [board, dispatch] = useReducer(boardReducer, initialBoard)
  const py = usePythonRunner()
  const { trace } = py
  const boardRef = useRef(board)
  boardRef.current = board
  // The tutor asked to see a trace: run it here, put it on the board, tell the tutor.
  const onTrace = useCallback(async (nodeId: string) => {
    const node = boardRef.current.nodes[nodeId]
    if (node?.type !== 'code') return
    const steps = await trace(node.source)
    for (const op of traceOps(boardRef.current, nodeId, node.source, steps)) dispatch({ op, actor: 'client' })
    void sendRef.current({ type: 'trace_result', nodeId, source: node.source, steps })
  }, [trace])
  const { captions, live, mascot, busy, send } = useTutor(projectId, dispatch, lastCaption ? [lastCaption] : [], onTrace)
  const sendRef = useRef(send)
  sendRef.current = send
  const [runningId, setRunningId] = useState<string | null>(null)
  const [tasksOpen, setTasksOpen] = useState(true)
  const [confetti, setConfetti] = useState<{ key: string; big: boolean }>({ key: '', big: false })

  // Tasks are checked against the student's program on the board.
  const code = boardCode(board) ?? ''
  const progress = useLessonProgress({
    lesson,
    projectId,
    code,
    initialCompletedTaskIds: completedTaskIds,
    initialSubmissionStatus: submission,
    onHighlight: (lines) => {
      const id = codeNodeId(boardRef.current)
      if (id) dispatch({ op: { op: 'update', id, patch: { highlightLines: lines } }, actor: 'client' })
    },
    onPrompt: () => {},
    onComplete: (task, done) => setConfetti({ key: `${task.id}:${Date.now()}`, big: lesson != null && done.size === lesson.tasks.length }),
  })
  const checkFiles = useMemo(() => ({ ...files, [entry]: code }), [files, entry, code])
  const runtimeChecks = useRuntimeChecks(progress.activeTask, checkFiles, entry)

  // Autosave: what the student typed survives a closed tab. Never while the tutor is
  // mid-turn (the server owns the board then); the effect re-runs when the turn ends.
  const saved = useRef(initialBoard)
  useEffect(() => {
    if (busy || board === saved.current) return
    const timer = setTimeout(() => {
      saved.current = board
      void fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, board, files: withBoardCode(files, entry, board) }),
      }).catch(() => { saved.current = initialBoard })
    }, 1200)
    return () => clearTimeout(timer)
  }, [board, busy, projectId, files, entry, initialBoard])
  const started = useRef(false)
  const [mood, setMood] = useState<MascotState | null>(null)
  useEffect(() => {
    if (!mood) return
    const t = setTimeout(() => setMood(null), 3000)
    return () => clearTimeout(t)
  }, [mood])

  // A brand-new board opens with the tutor greeting the student.
  useEffect(() => {
    if (started.current || board.pages.length) return
    started.current = true
    void send({ type: 'session_start' })
  }, [board.pages.length, send])

  // A run has finished when the worker goes back to idle (or is restarted after a timeout).
  const prev = useRef(py.status)
  const latest = useRef({ board, output: py.output, runningId })
  latest.current = { board, output: py.output, runningId }
  useEffect(() => {
    const was = prev.current
    prev.current = py.status
    const { board: b, output, runningId: id } = latest.current
    if (!id || !(was === 'running' || was === 'waiting') || (py.status !== 'idle' && py.status !== 'loading')) return
    const node = b.nodes[id]
    if (node?.type !== 'code') return
    const result = {
      source: node.source,
      stdout: output.filter((c) => c.kind === 'out' || c.kind === 'in').map((c) => c.text).join(''),
      stderr: output.filter((c) => c.kind === 'err' || c.kind === 'note').map((c) => c.text).join(''),
      ok: !output.some((c) => c.kind === 'err' || c.kind === 'note'),
    }
    for (const op of runOps(b, id, result)) dispatch({ op, actor: 'client' })
    setRunningId(null)
    setMood(result.ok ? 'celebrating' : 'puzzled')
    void send({ type: 'code_run_result', nodeId: id, ...result })
  }, [py.status, send])

  const codeActions: CodeActions = {
    ready: py.status === 'idle' || py.status === 'running' || py.status === 'waiting',
    runningId,
    waiting: py.status === 'waiting',
    run: (node, source) => {
      codeActions.edit(node.id, source) // keep the board copy in step with what is run
      setRunningId(node.id)
      py.run({ ...files, [entry]: source }, entry)
    },
    stop: py.stop,
    edit: (id, source) => dispatch({ op: { op: 'update', id, patch: { source } }, actor: 'client' }),
    sendInput: py.sendInput,
    setCursor: (id, cursor) => dispatch({ op: { op: 'update', id, patch: { cursor } }, actor: 'client' }),
  }

  const side = lesson && (
    <>
      {/* Always mounted so the width can animate; inert keeps the closed panel out of tab order. */}
      <div
        inert={!tasksOpen}
        className={`shrink-0 overflow-hidden transition-[width,opacity] duration-500 ease-in-out motion-reduce:transition-none ${tasksOpen ? 'w-72 opacity-100 lg:w-80' : 'w-0 opacity-0'}`}
      >
        <aside className="flex h-full w-72 flex-col overflow-hidden rounded-3xl bg-surface-800 shadow-md lg:w-80" aria-label="Tasks">
          <button onClick={() => setTasksOpen(false)} aria-label="Collapse tasks" title="Collapse tasks" className="ml-3 mt-3 flex h-8 w-8 items-center justify-center self-start rounded-full text-fg-muted transition-colors hover:bg-muted hover:text-fg-primary">
            <PanelLeft className="h-5 w-5" />
          </button>
          <div className="min-h-0 flex-1">
            <RuntimeChecksContext.Provider value={runtimeChecks}>
              <Navigator lesson={lesson} code={code} progress={progress} classSlots={classSlots} />
            </RuntimeChecksContext.Provider>
          </div>
        </aside>
      </div>
      {!tasksOpen && (
        <button onClick={() => setTasksOpen(true)} className="board-rise h-fit rounded-xl bg-[#2b2118] px-3 py-2 text-sm font-bold text-[#faf6ee]">Tasks</button>
      )}
    </>
  )

  return (
    <>
      <ConfettiBurst trigger={confetti.key} big={confetti.big} />
      <BoardView
        board={board}
        captions={captions}
        live={live}
        mascot={mascot}
        mood={mood}
        code={codeActions}
        busy={busy}
        side={side}
        onSend={(text) => void send({ type: 'student_message', text })}
      />
    </>
  )
}
