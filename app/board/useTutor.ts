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

  const send = useCallback(async (event: ClientEvent) => {
    if (inFlight.current) { queued.current = event; return }
    inFlight.current = true
    setBusy(true)
    let said = ''
    const traces: string[] = [] // run after the turn, once the interpreter and the board are settled
    try {
      const res = await fetch(`/api/projects/${projectId}/turn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...extra(), ...event }) })
      if (!res.ok || !res.body) throw new Error(res.status === 429 ? 'Spark needs a rest. Try again later.' : 'Spark had a problem. Try again.')
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
          if (e.type === 'caption.delta') { said += e.text; setLive(said) }
          else if (e.type === 'board.op') dispatch({ op: e.op, actor: 'tutor' })
          else if (e.type === 'trace.request') traces.push(e.nodeId)
          else if (e.type === 'agent.state') setMascot(e.state === 'idle' ? 'idle' : e.state)
          else if (e.type === 'error') throw new Error(e.message)
        }
      }
    } catch (err) {
      said = said || (err instanceof Error ? err.message : 'Spark had a problem. Try again.')
    } finally {
      if (said) setCaptions((c) => [...c, said])
      setLive('')
      setMascot('idle')
      setBusy(false)
      inFlight.current = false
      traces.forEach(onTrace)
      const next = queued.current
      if (next) { queued.current = null; void selfRef.current?.(next) }
    }
  }, [projectId, dispatch, onTrace, extra])
  selfRef.current = send

  return { captions, live, mascot, busy, send }
}
