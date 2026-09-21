'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { boardReducer, type BoardState } from '@/lib/board/reducer'
import { runOps, traceOps } from '@/lib/board/run'
import { usePythonRunner } from '@/hooks/usePythonRunner'
import { boardCode, boardFiles, fileOf, pageCode, withBoardCode } from '@/lib/board/code'
import {
  awaitingEditor,
  isTaskOpen,
  nextStepIndex,
  cheer,
  stepAction,
  stepNode,
  stepNodeId,
  taskCodeNodeId,
  taskFile,
  taskForPageId,
  taskIndexForPageId,
  taskPageId,
  taskStarter,
} from '@/lib/board/tasks'
import { firstUnfinishedTaskIndex, useLessonProgress } from '@/hooks/useLessonProgress'
import { useRuntimeChecks } from '@/hooks/useRuntimeChecks'
import { useTaskChecks } from '@/hooks/useTaskChecks'
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
import { speak, speechSupported, stopSpeaking } from '@/lib/speech'

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

export default function LiveBoard({
  projectId,
  initialBoard,
  lastCaption,
  lesson,
  entry,
  files,
  completedTaskIds,
  submission,
  classSlots,
}: Props) {
  const [board, dispatch] = useReducer(boardReducer, initialBoard)
  const py = usePythonRunner()
  const { trace } = py
  const boardRef = useRef(board)
  boardRef.current = board
  // The tutor asked to see a trace: run it here, put it on the board, tell the tutor.
  const onTrace = useCallback(
    async (nodeId: string) => {
      const node = boardRef.current.nodes[nodeId]
      if (node?.type !== 'code') return
      const steps = await trace(node.source)
      for (const op of traceOps(boardRef.current, nodeId, node.source, steps))
        dispatch({ op, actor: 'client' })
      void sendRef.current({ type: 'trace_result', nodeId, source: node.source, steps })
    },
    [trace]
  )
  // The tutor decides a task is done and the server records it; this only
  // takes the recorded list and moves on.
  const onTaskDone = useCallback(
    (_taskId: string, ids: string[]) => progressRef.current.applyDone(ids),
    []
  )
  const { captions, live, mascot, busy, send, say } = useTutor(
    projectId,
    dispatch,
    lastCaption ? [lastCaption] : [],
    onTrace,
    undefined,
    onTaskDone
  )
  const sendRef = useRef(send)
  sendRef.current = send
  // Sparky's voice: reads each new caption (the instruction of a box that just opened, or feedback)
  // aloud. Off until the student turns it on; the choice is a per-browser convenience.
  const [canSpeak, setCanSpeak] = useState(false)
  const [voice, setVoice] = useState(false)
  useEffect(() => {
    setCanSpeak(speechSupported())
    try {
      setVoice(localStorage.getItem('spark-voice') === '1')
    } catch {
      /* private window: stays off */
    }
    return () => stopSpeaking()
  }, [])
  const toggleVoice = useCallback(() => {
    setVoice((on) => {
      try {
        localStorage.setItem('spark-voice', on ? '0' : '1')
      } catch {
        /* not remembered */
      }
      if (on) stopSpeaking()
      return !on
    })
  }, [])
  const spoken = useRef(captions.length) // captions already on screen at load are not read out
  useEffect(() => {
    if (captions.length > spoken.current && voice) speak(captions[captions.length - 1])
    spoken.current = captions.length
  }, [captions, voice])
  const [runningId, setRunningId] = useState<string | null>(null)
  const [confetti, setConfetti] = useState<{ key: string; big: boolean }>({ key: '', big: false })
  // True between a task completing and its successor's page opening, so the
  // reconciler below does not race the celebration and open it early.
  const [advancing, setAdvancing] = useState(false)
  const [won, setWon] = useState<string | null>(null) // "+10 XP · <what they did>" while the confetti plays
  const [viewedPageId, setViewedPageId] = useState<string | null>(initialBoard.activePageId)
  const onViewPage = useCallback((id: string) => setViewedPageId(id), [])

  // Everything the server decides — whether a task is finished, what the tutor
  // is told — is read from the persisted board, so it has to be written before
  // either is asked. The debounced autosave is not enough on its own.
  const saved = useRef(initialBoard)
  const saveBoard = useCallback(
    async (b: BoardState) => {
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
    },
    [projectId, files, entry, initialBoard]
  )

  // One page per task, and the page the student is looking at is the task they
  // are working on. The code a task is judged on is the code on its own page:
  // boardCode spans the whole board and would hand an open task the code of a
  // later one the moment another page appeared.
  const currentPageId = viewedPageId ?? board.activePageId
  const viewedTask = taskForPageId(lesson, currentPageId)
  // A task with steps has no editor until they are done. Its code is then empty,
  // never boardCode (the previous task's program): the checks would judge, and
  // auto-complete on, code the student did not write for this task.
  const waiting = awaitingEditor(board, viewedTask, currentPageId)
  const code = waiting ? '' : (pageCode(board, currentPageId) ?? boardCode(board) ?? '')

  // A task with its own starter is judged on its own program, not on whichever
  // page's code happens to be newest in the entry file.
  const ownEntry = viewedTask?.starter !== undefined && !waiting
  const checkFiles = useMemo(
    () => ({ ...files, ...boardFiles(board, entry), ...(ownEntry ? { [entry]: code } : {}) }),
    [files, board, entry, ownEntry, code]
  )
  const runtimeChecks = useRuntimeChecks(
    waiting ? undefined : (viewedTask ?? undefined),
    checkFiles,
    entry
  )
  const checks = useTaskChecks(viewedTask ?? undefined, code, runtimeChecks)

  const progress = useLessonProgress({
    lesson,
    projectId,
    code,
    initialCompletedTaskIds: completedTaskIds,
    initialSubmissionStatus: submission,
    onComplete: (task, done) => {
      setConfetti({
        key: `${task.id}:${Date.now()}`,
        big: lesson != null && done.size === lesson.tasks.length,
      })
      setWon(`+${taskXp(task)} XP · ${task.success}`)
      setTimeout(() => setWon(null), CONFETTI_MS + 600)
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
  const carry = useRef<Record<string, string>>({}) // program handed over while a task's steps are still showing
  const addStep = useCallback(
    (task: LessonTask, i: number) => {
      const node = stepNode(task, i)
      // Same double-run trap as `opened`: apply() throws on a duplicate id.
      if (!node || opened.current.has(node.id) || boardRef.current.nodes[node.id]) return
      opened.current.add(node.id)
      dispatch({ op: { op: 'add', pageId: taskPageId(task), node }, actor: 'client' })
      // The box's instruction, from Sparky as well as in the box, so a child who reads slowly can listen instead.
      if ('prompt' in node)
        say(`${i > 0 ? `${cheer(i)} Now: ` : ''}${node.prompt} ${stepAction(node)}`.trim())
    },
    [say]
  )
  const addEditor = useCallback(
    (task: LessonTask, prevSource?: string) => {
      const b = boardRef.current
      const nodeId = taskCodeNodeId(task)
      if (opened.current.has(nodeId) || b.nodes[nodeId]) return
      opened.current.add(nodeId)
      // Say what to do before the editor appears. Scripted, so it costs no tutor turn.
      const goId = `go_${nodeId}`
      if (task.go && !opened.current.has(goId) && !b.nodes[goId]) {
        opened.current.add(goId)
        dispatch({
          op: {
            op: 'add',
            pageId: taskPageId(task),
            node: {
              id: goId,
              parentId: null,
              createdBy: 'system',
              type: 'text',
              markdown: `**${task.go}**`,
            },
          },
          actor: 'client',
        })
      }
      const file = taskFile(task, entry)
      // A task with its own starter is its own program; the rest share the carried file.
      const own = file === entry ? taskStarter(b, task) : null
      const source =
        own ??
        (file === entry
          ? (prevSource ?? carry.current[task.id] ?? boardCode(b) ?? files[entry])
          : files[file]) ??
        ''
      dispatch({
        op: {
          op: 'add',
          pageId: taskPageId(task),
          node: {
            id: nodeId,
            parentId: null,
            createdBy: 'student',
            type: 'code',
            language: 'python',
            file: file === entry ? undefined : file,
            anchor: own === null ? task.commentAnchor : undefined,
            source,
            editable: true,
          },
        },
        actor: 'client',
      })
    },
    [entry, files]
  )
  const openPageFor = useCallback(
    (task: LessonTask, prevSource?: string) => {
      const b = boardRef.current
      const pageId = taskPageId(task)
      if (opened.current.has(pageId) || b.pages.some((p) => p.id === pageId)) return
      opened.current.add(pageId)
      dispatch({ op: { op: 'new_page', pageId, title: task.chip }, actor: 'client' })
      if (task.steps?.length) {
        // Concept first: the editor opens after the last step (the effect below).
        if (prevSource !== undefined) carry.current[task.id] = prevSource
        addStep(task, 0)
      } else {
        addEditor(task, prevSource)
      }
    },
    [addStep, addEditor]
  )

  // Reveal a task's steps one at a time as the student answers, then its editor.
  // Runs off the board, so a reload mid-steps resumes exactly where they were.
  useEffect(() => {
    const task = viewedTask
    if (!task?.steps?.length || !board.pages.some((p) => p.id === taskPageId(task))) return
    if (board.nodes[taskCodeNodeId(task)]) return
    const next = nextStepIndex(board, task)
    if (next !== null) {
      addStep(task, next)
      return
    }
    const last = stepNodeId(task, task.steps.length - 1)
    const lastNode = board.nodes[last]
    if (
      lastNode &&
      'answered' in lastNode &&
      lastNode.answered &&
      !opened.current.has(taskCodeNodeId(task))
    ) {
      addEditor(task)
      // The greeting above still says "answer the question", which is no longer true.
      say(`${cheer(task.steps.length)} The editor is open. Type your change, then press Run.`)
    }
  }, [board, viewedTask, addStep, addEditor, say])

  // A finished task hands its program to the next one, then Spark introduces it.
  const advanceTo = useCallback(
    (finished: LessonTask, done: Set<string>) => {
      const carried =
        pageCode(boardRef.current, taskPageId(finished)) ?? boardCode(boardRef.current) ?? ''
      const delay =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : CONFETTI_MS
      setTimeout(() => {
        const next = lesson?.tasks[firstUnfinishedTaskIndex(lesson.tasks, done)]
        const unfinished = next && !done.has(next.id) ? next : null
        if (unfinished) {
          openPageFor(unfinished, carried)
          setViewedPageId(taskPageId(unfinished))
        }
        setAdvancing(false)
        // The tutor reads the board from the database, so the new page has to be
        // there before it is asked to introduce it.
        void saveBoard(boardRef.current).then(() =>
          sendRef.current({
            type: 'task_advanced',
            done: finished.id,
            next: unfinished?.id ?? null,
            pageId: unfinished ? taskPageId(unfinished) : null,
          })
        )
      }, delay)
    },
    [lesson, openPageFor, saveBoard]
  )

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
    const timer = setTimeout(() => {
      void saveBoard(boardRef.current)
    }, 1200)
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

  // A task's second program appears under its first once the check it waits on
  // passes: its own code block, so its own Run and output.
  const revealed = useRef(new Set<string>())
  useEffect(() => {
    const task = viewedTask
    const then = task?.then
    if (!task || !then || waiting) return
    const codeId = `${taskCodeNodeId(task)}_2`
    if (revealed.current.has(codeId) || board.nodes[codeId] || !checks.results[then.after]?.passed)
      return
    // Typing must never open the next block: only a Run of this exact code does.
    const first = board.nodes[taskCodeNodeId(task)]
    const ran = board.nodes[`out_${taskCodeNodeId(task)}`]
    if (first?.type !== 'code' || ran?.type !== 'output' || ran.ran !== first.source) return
    revealed.current.add(codeId)
    const pageId = taskPageId(task)
    dispatch({
      op: {
        op: 'add',
        pageId,
        node: {
          id: `go_${codeId}`,
          parentId: null,
          createdBy: 'system',
          type: 'text',
          markdown: `**${then.go}**`,
        },
      },
      actor: 'client',
    })
    dispatch({
      op: {
        op: 'add',
        pageId,
        node: {
          id: codeId,
          parentId: null,
          createdBy: 'student',
          type: 'code',
          language: 'python',
          file: then.file,
          source: then.source,
          editable: true,
        },
      },
      actor: 'client',
    })
    dispatch({ op: { op: 'focus', id: `go_${codeId}` }, actor: 'client' })
  }, [viewedTask, waiting, board, checks.results])

  // A run has finished when the worker goes back to idle (or is restarted after a timeout).
  const prev = useRef(py.status)
  const latest = useRef({ board, output: py.output, runningId })
  latest.current = { board, output: py.output, runningId }
  useEffect(() => {
    const was = prev.current
    prev.current = py.status
    const { board: b, output, runningId: id } = latest.current
    if (
      !id ||
      !(was === 'running' || was === 'waiting') ||
      (py.status !== 'idle' && py.status !== 'loading')
    )
      return
    const node = b.nodes[id]
    if (node?.type !== 'code') return
    const result = {
      source: node.source,
      stdout: output
        .filter((c) => c.kind === 'out' || c.kind === 'in')
        .map((c) => c.text)
        .join(''),
      stderr: output
        .filter((c) => c.kind === 'err' || c.kind === 'note')
        .map((c) => c.text)
        .join(''),
      ok: !output.some((c) => c.kind === 'err' || c.kind === 'note'),
    }
    for (const op of runOps(b, id, result)) dispatch({ op, actor: 'client' })
    setRunningId(null)
    setMood(result.ok ? 'celebrating' : 'puzzled')
    // The server reads the board from the database: a block revealed a moment ago
    // must be there before it is told a run happened in it.
    void saveBoard(boardRef.current).then(() =>
      send({ type: 'code_run_result', nodeId: id, ...result })
    )
  }, [py.status, send, saveBoard])

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
    edit: (id, source) =>
      dispatch({ op: { op: 'update', id, patch: { source } }, actor: 'client' }),
    sendInput: py.sendInput,
    setCursor: (id, cursor) =>
      dispatch({ op: { op: 'update', id, patch: { cursor } }, actor: 'client' }),
    patch: (id, patch) => dispatch({ op: { op: 'update', id, patch }, actor: 'client' }),
    // The board reducer has not run yet when a step calls this in the same click, so wait a beat:
    // the tutor reads the misses and picks from the saved board.
    feedback: (event) => {
      setTimeout(() => {
        void saveBoard(boardRef.current).then(() => send(event))
      }, 120)
    },
  }

  const statusOf = useCallback(
    (pageId: string): PageStatus => {
      if (!lesson) return 'open'
      const index = taskIndexForPageId(lesson, pageId)
      if (index < 0) return 'open'
      const task = lesson.tasks[index]
      if (progress.done.has(task.id)) return 'done'
      if (task.id === viewedTask?.id) return 'current'
      if (
        isTaskLocked(lesson.tasks, index, progress.done) ||
        !isTaskOpen(lesson, index, progress.done)
      )
        return 'locked'
      return 'open'
    },
    [lesson, progress.done, viewedTask]
  )

  // A choice or bonus the student does not want must not wall off the homework
  // behind it, and there is no Mark done button to click past it with.
  const skip = useCallback(
    (task: LessonTask) => {
      if (!lesson) return
      const next = lesson.tasks
        .slice(lesson.tasks.indexOf(task) + 1)
        .find((t) => !progress.done.has(t.id))
      if (!next) return
      openPageFor(next, pageCode(boardRef.current, taskPageId(task)) ?? undefined)
      setViewedPageId(taskPageId(next))
    },
    [lesson, progress.done, openPageFor]
  )

  const header = useCallback(
    (pageId: string) => {
      const task = taskForPageId(lesson, pageId)
      if (!task) return null
      const showing = task.id === viewedTask?.id
      const optional = task.type === 'choice' || task.type === 'bonus'
      return (
        <TaskHeader
          task={task}
          results={showing && !waiting ? checks.results : []}
          evaluated={showing && !waiting ? checks.evaluated : true}
          waiting={showing && waiting}
          done={progress.done.has(task.id)}
          busy={busy}
          error={showing ? progress.saveError : null}
          onSkip={optional ? () => skip(task) : undefined}
          onStuck={() =>
            void sendRef.current({
              type: 'student_message',
              text: 'I am stuck on this task. Please show me exactly what to change.',
            })
          }
        />
      )
    },
    [lesson, viewedTask, waiting, progress.done, progress.saveError, checks, busy, skip]
  )

  const footer = useCallback(
    (pageId: string) => {
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
    },
    [
      lesson,
      progress.done,
      progress.submission,
      progress.isSubmitting,
      progress.submitError,
      progress.submitHomework,
      classSlots,
    ]
  )

  return (
    <>
      <ConfettiBurst trigger={confetti.key} big={confetti.big} />
      {won && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg"
        >
          {won}
        </div>
      )}
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
        progress={
          lesson ? (
            <ProgressBar
              done={progress.done.size}
              total={lesson.tasks.length}
              xp={lesson.tasks.reduce(
                (sum, t) => sum + (progress.done.has(t.id) ? taskXp(t) : 0),
                0
              )}
            />
          ) : undefined
        }
        statusOf={lesson ? statusOf : undefined}
        onViewPage={onViewPage}
        voice={canSpeak ? voice : undefined}
        onVoice={toggleVoice}
        onSend={(text) => void send({ type: 'student_message', text })}
      />
    </>
  )
}
