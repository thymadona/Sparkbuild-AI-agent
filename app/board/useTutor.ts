'use client'

import { useCallback, useRef, useState, type Dispatch } from 'react'
import type { BoardAction } from '@/lib/board/reducer'
import type { ClientEvent } from '@/lib/tutor/events'
import type { MascotState } from './Mascot'

// Sends one event to the tutor and applies the SSE reply as it streams in.
export function useTutor(
  projectId: string,
  dispatch: Dispatch<BoardAction>,
  firstCaption: string[],
  onTrace: (nodeId: string) => void = () => {},
  // Extra fields posted alongside the event, read fresh at send time. The
  // student's browser owns the Python interpreter, so its check verdicts ride
  // along here — the server cannot compute them.
  extra: () => Record<string, unknown> = () => ({}),
  // The tutor recorded a task as done. Called once the stream has ended, so the
  // client's next-page save cannot be overwritten by the server's end-of-turn write.
  onTaskComplete: (taskId: string, done: string[]) => void = () => {}
) {
  const [captions, setCaptions] = useState<string[]>(firstCaption)
  const [live, setLive] = useState('')
  const [mascot, setMascot] = useState<MascotState>('idle')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  // One pending event. A turn takes seconds, and the events that matter most
  // (a finished run, a completed task) are raised while one is streaming —
  // dropping them silently is how the tutor ends up out of step with the board.
  const queued = useRef<ClientEvent | null>(null)
  const selfRef = useRef<((e: ClientEvent) => Promise<void>) | null>(null)

  const send = useCallback(
    async (event: ClientEvent) => {
      if (inFlight.current) {
        queued.current = event
        return
      }
      inFlight.current = true
      setBusy(true)
      let said = ''
      // Feedback on a wrong pick is a bonus on top of the hint already on screen: if the turn fails
      // (too fast, network), say nothing rather than a scary caption.
      const quiet = event.type === 'step_answer' || event.type === 'stage_result'
      let completed: { taskId: string; done: string[] } | null = null
      const traces: string[] = [] // run after the turn, once the interpreter and the board are settled
      try {
        const res = await fetch(`/api/projects/${projectId}/turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...extra(), ...event }),
        })
        if (!res.ok || !res.body)
          throw new Error(
            res.status === 429
              ? 'Whoa, too fast! Wait a moment and try again.'
              : 'Sparky had a problem. Try again.'
          )
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const frames = buf.split('\n\n')
          buf = frames.pop() ?? ''
          for (const f of frames) {
            if (!f.startsWith('data: ')) continue
            const e = JSON.parse(f.slice(6))
            if (e.type === 'caption.delta') {
              said += e.text
              setLive(said)
            } else if (e.type === 'board.op') dispatch({ op: e.op, actor: 'tutor' })
            else if (e.type === 'trace.request') traces.push(e.nodeId)
            else if (e.type === 'task.complete')
              completed = { taskId: e.taskId, done: e.completedTaskIds }
            else if (e.type === 'agent.state') setMascot(e.state === 'idle' ? 'idle' : e.state)
            else if (e.type === 'error') throw new Error(e.message)
          }
        }
      } catch (err) {
        said =
          said ||
          (quiet ? '' : err instanceof Error ? err.message : 'Sparky had a problem. Try again.')
      } finally {
        if (said) setCaptions((c) => [...c, said])
        setLive('')
        setMascot('idle')
        setBusy(false)
        inFlight.current = false
        traces.forEach(onTrace)
        if (completed) {
          const c = completed as { taskId: string; done: string[] }
          onTaskComplete(c.taskId, c.done)
        }
        const next = queued.current
        if (next) {
          queued.current = null
          void selfRef.current?.(next)
        }
      }
    },
    [projectId, dispatch, onTrace, extra, onTaskComplete]
  )
  selfRef.current = send

  // A scripted line from the board itself (no tutor turn), e.g. when the editor opens.
  const say = useCallback((text: string) => setCaptions((c) => [...c, text]), [])

  return { captions, live, mascot, busy, send, say }
}
