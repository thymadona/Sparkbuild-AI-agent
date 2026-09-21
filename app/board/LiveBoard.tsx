'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { boardReducer, type BoardState } from '@/lib/board/reducer'
import { runOps, traceOps } from '@/lib/board/run'
import { usePythonRunner } from '@/hooks/usePythonRunner'
import { boardCode, boardFiles, fileOf, pageCode, pageCodeNodeId, withBoardCode } from '@/lib/board/code'
import { isTaskOpen, taskCodeNodeId, taskFile, taskForPageId, taskIndexForPageId, taskPageId } from '@/lib/board/tasks'
import { firstUnfinishedTaskIndex, useLessonProgress } from '@/hooks/useLessonProgress'
import { useRuntimeChecks } from '@/hooks/useRuntimeChecks'
import { useTaskChecks } from '@/hooks/useTaskChecks'
import { useAutoComplete } from '@/hooks/useAutoComplete'
import { isTaskLocked } from '@/lib/task-guard'
import ConfettiBurst from '@/components/ConfettiBurst'
import type { Lesson, LessonTask } from '@/lib/lessons'
import type { ClassSlot } from '@/lib/schedule'
import type { SubmissionStatus } from '@/types'
import BoardView, { type PageStatus } from './BoardView'
import TaskHeader from './TaskHeader'
import ProgressBar from './ProgressBar'
import { taskXp } from '@/lib/xp'
import HomeworkFooter from './HomeworkFooter'
import type { MascotState } from './Mascot'
import type { CodeActions } from './Nodes'
import { useTutor } from './useTutor'

// Long enough to read as a celebration, short enough not to feel like a wait.
const CONFETTI_MS = 1400

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
  // The server cannot run Python, so it is told what the browser's checks found.
  const runtimeRef = useRef<{ taskId: string; verdicts: (boolean | undefined)[] } | null>(null)
  const extraBody = useCallback(() => ({ runtimeChecks: runtimeRef.current }), [])
  const { captions, live, mascot, busy, send } = useTutor(projectId, dispatch, lastCaption ? [lastCaption] : [], onTrace, extraBody)
  const sendRef = useRef(send)
  sendRef.current = send
  const [runningId, setRunningId] = useState<string | null>(null)
  const [confetti, setConfetti] = useState<{ key: string; big: boolean }>({ key: '', big: false })
  // True between a task completing and its successor's page opening, so the
  // reconciler below does not race the celebration and open it early.
  const [advancing, setAdvancing] = useState(false)
  const [viewedPageId, setViewedPageId] = useState<string | null>(initialBoard.activePageId)
  const onViewPage = useCallback((id: string) => setViewedPageId(id), [])
  const viewedRef = useRef(viewedPageId)

  // Everything the server decides — whether a task is finished, what the tutor
  // is told — is read from the persisted board, so it has to be written before
  // either is asked. The debounced autosave is not enough on its own.
  const saved = useRef(initialBoard)
  const saveBoard = useCallback(async (b: BoardState) => {
    if (b === saved.current) return
    saved.current = b
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, board: b, files: withBoardCode(files, entry, b) }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch {
      saved.current = initialBoard // keep it dirty so the next pass retries
    }
  }, [projectId, files, entry, initialBoard])

  // One page per task, and the page the student is looking at is the task they
  // are working on. The code a task is judged on is the code on its own page:
  // boardCode spans the whole board and would hand an open task the code of a
  // later one the moment another page appeared.
  const currentPageId = viewedPageId ?? board.activePageId
  viewedRef.current = currentPageId
  const viewedTask = taskForPageId(lesson, currentPageId)
  const code = pageCode(board, currentPageId) ?? boardCode(board) ?? ''

  const checkFiles = useMemo(() => ({ ...files, ...boardFiles(board, entry) }), [files, board, entry])
  const runtimeChecks = useRuntimeChecks(viewedTask ?? undefined, checkFiles, entry)
  runtimeRef.current = runtimeChecks
  const checks = useTaskChecks(viewedTask ?? undefined, code, runtimeChecks)

  const progress = useLessonProgress({
    lesson,
    projectId,
    code,
    initialCompletedTaskIds: completedTaskIds,
    initialSubmissionStatus: submission,
    onHighlight: (lines) => {
      const id = pageCodeNodeId(boardRef.current, viewedRef.current)
      if (id) dispatch({ op: { op: 'update', id, patch: { highlightLines: lines } }, actor: 'client' })
    },
    onPrompt: () => {},
    runtime: () => runtimeRef.current,
    beforeComplete: () => saveBoard(boardRef.current),
    onComplete: (task, done) => {
      setConfetti({ key: `${task.id}:${Date.now()}`, big: lesson != null && done.size === lesson.tasks.length })
      setAdvancing(true)
      advanceTo(task, done)
    },
  })
  const progressRef = useRef(progress)
  progressRef.current = progress


  // Opening a task's page. The code carries forward so the student keeps the
  // program they have built; a task that works in another file (bugzap) starts
  // from that file instead.
  // `opened` is checked as well as the board itself: two calls in one tick
  // (StrictMode's double-invoked effects, or a reconcile landing on the same
  // page as an advance) would both read a boardRef that has not committed yet,
  // and the second new_page throws out of the reducer.
  const opened = useRef(new Set(initialBoard.pages.map((p) => p.id)))
  const openPageFor = useCallback((task: LessonTask, prevSource?: string) => {
    const b = boardRef.current
    const pageId = taskPageId(task)
    if (opened.current.has(pageId) || b.pages.some((p) => p.id === pageId)) return
    opened.current.add(pageId)
    dispatch({ op: { op: 'new_page', pageId, title: task.chip }, actor: 'client' })
    const nodeId = taskCodeNodeId(task)
    if (b.nodes[nodeId]) return
    const file = taskFile(task, entry)
    const source = (file === entry ? prevSource ?? boardCode(b) ?? files[entry] : files[file]) ?? ''
    dispatch({
      op: {
        op: 'add',
        pageId,
        node: { id: nodeId, parentId: null, createdBy: 'student', type: 'code', language: 'python', file: file === entry ? undefined : file, source, editable: true, highlightLines: [] },
      },
      actor: 'client',
    })
  }, [entry, files])

  // A finished task hands its program to the next one, then Spark introduces it.
  const advanceTo = useCallback((finished: LessonTask, done: Set<string>) => {
    const carried = pageCode(boardRef.current, taskPageId(finished)) ?? boardCode(boardRef.current) ?? ''
    const delay = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : CONFETTI_MS
    setTimeout(() => {
      const next = lesson?.tasks[firstUnfinishedTaskIndex(lesson.tasks, done)]
      const unfinished = next && !done.has(next.id) ? next : null
      if (unfinished) { openPageFor(unfinished, carried); setViewedPageId(taskPageId(unfinished)) }
      setAdvancing(false)
      // The tutor reads the board from the database, so the new page has to be
      // there before it is asked to introduce it.
      void saveBoard(boardRef.current).then(() =>
        sendRef.current({ type: 'task_advanced', done: finished.id, next: unfinished?.id ?? null, pageId: unfinished ? taskPageId(unfinished) : null }),
      )
    }, delay)
  }, [lesson, openPageFor, saveBoard])

  // Make sure the task the student is on has a page. Normally advanceTo has
  // already opened it; this covers the first visit and a board that predates
  // task pages (boardFromFiles leaves one loose "p_main").
  useEffect(() => {
    if (!lesson || advancing) return
    const task = progressRef.current.activeTask
    if (task) openPageFor(task)
  }, [lesson, advancing, progress.activeIndex, openPageFor])

  // Autosave: what the student typed survives a closed tab. Never while the tutor is
  // mid-turn (the server owns the board then); the effect re-runs when the turn ends.
  useEffect(() => {
    if (busy || board === saved.current) return
    const timer = setTimeout(() => { void saveBoard(boardRef.current) }, 1200)
    return () => clearTimeout(timer)
  }, [board, busy, saveBoard])
  const started = useRef(false)
  const [mood, setMood] = useState<MascotState | null>(null)
  useEffect(() => {
    if (!mood) return
    const t = setTimeout(() => setMood(null), 3000)
    return () => clearTimeout(t)
  }, [mood])

  // A brand-new board opens with the tutor greeting the student. On a lesson
  // this waits for the first task page to exist and be written: the tutor reads
  // the board from the database and would otherwise be told it is empty, then
  // persist that emptiness back over the page this client just seeded.
  useEffect(() => {
    if (started.current || initialBoard.pages.length) return
    if (lesson && !board.pages.length) return
    started.current = true
    void saveBoard(boardRef.current).then(() => send({ type: 'session_start' }))
  }, [initialBoard.pages.length, lesson, board.pages.length, send, saveBoard])

  const viewedIndex = lesson && viewedTask ? lesson.tasks.indexOf(viewedTask) : -1
  useAutoComplete({
    enabled: lesson != null && viewedIndex >= 0,
    taskId: viewedTask?.id,
    done: viewedTask ? progress.done.has(viewedTask.id) : false,
    saving: progress.isSaving,
    checks,
    code,
    complete: () => void progressRef.current.markDone(viewedIndex),
  })

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
      // A task that lives in another file runs that file, not the entry.
      const target = fileOf(node, entry)
      py.run({ ...files, ...boardFiles(boardRef.current, entry), [target]: source }, target)
    },
    stop: py.stop,
    edit: (id, source) => dispatch({ op: { op: 'update', id, patch: { source } }, actor: 'client' }),
    sendInput: py.sendInput,
    setCursor: (id, cursor) => dispatch({ op: { op: 'update', id, patch: { cursor } }, actor: 'client' }),
  }

  const statusOf = useCallback((pageId: string): PageStatus => {
    if (!lesson) return 'open'
    const index = taskIndexForPageId(lesson, pageId)
    if (index < 0) return 'open'
    const task = lesson.tasks[index]
    if (progress.done.has(task.id)) return 'done'
    if (task.id === viewedTask?.id) return 'current'
    if (isTaskLocked(lesson.tasks, index, progress.done) || !isTaskOpen(lesson, index, progress.done)) return 'locked'
    return 'open'
  }, [lesson, progress.done, viewedTask])

  // A choice or bonus the student does not want must not wall off the homework
  // behind it, and there is no Mark done button to click past it with.
  const skip = useCallback((task: LessonTask) => {
    if (!lesson) return
    const next = lesson.tasks.slice(lesson.tasks.indexOf(task) + 1).find((t) => !progress.done.has(t.id))
    if (!next) return
    openPageFor(next, pageCode(boardRef.current, taskPageId(task)) ?? undefined)
    setViewedPageId(taskPageId(next))
  }, [lesson, progress.done, openPageFor])

  const header = useCallback((pageId: string) => {
    const task = taskForPageId(lesson, pageId)
    if (!task) return null
    const showing = task.id === viewedTask?.id
    const optional = task.type === 'choice' || task.type === 'bonus'
    return (
      <TaskHeader
        task={task}
        results={showing ? checks.results : []}
        evaluated={showing ? checks.evaluated : true}
        done={progress.done.has(task.id)}
        busy={busy}
        error={showing ? progress.saveError : null}
        onSkip={optional ? () => skip(task) : undefined}
        onStuck={() => void sendRef.current({ type: 'student_message', text: 'I am stuck on this task. Please show me exactly what to change.' })}
      />
    )
  }, [lesson, viewedTask, progress.done, progress.saveError, checks, busy, skip])

  const footer = useCallback((pageId: string) => {
    const task = taskForPageId(lesson, pageId)
    if (!lesson || task?.type !== 'homework') return null
    // Only under the last homework page, so hand-in appears once.
    const last = lesson.tasks.filter((t) => t.type === 'homework').at(-1)
    if (task.id !== last?.id) return null
    return (
      <HomeworkFooter
        lesson={lesson}
        done={progress.done}
        submission={progress.submission}
        isSubmitting={progress.isSubmitting}
        submitError={progress.submitError}
        onSubmit={progress.submitHomework}
        classSlots={classSlots}
      />
    )
  }, [lesson, progress.done, progress.submission, progress.isSubmitting, progress.submitError, progress.submitHomework, classSlots])

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
        header={lesson ? header : undefined}
        footer={lesson ? footer : undefined}
        progress={lesson ? <ProgressBar done={progress.done.size} total={lesson.tasks.length} xp={lesson.tasks.reduce((sum, t) => sum + (progress.done.has(t.id) ? taskXp(t) : 0), 0)} /> : undefined}
        statusOf={lesson ? statusOf : undefined}
        onViewPage={onViewPage}
        onSend={(text) => void send({ type: 'student_message', text })}
      />
    </>
  )
}
