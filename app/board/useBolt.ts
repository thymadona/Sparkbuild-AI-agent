'use client'

import { useCallback, useRef, useState, type Dispatch, type RefObject } from 'react'
import { apply, type BoardAction, type BoardState } from '@/lib/board/reducer'
import type { ClientEvent } from '@/lib/tutor/events'
import { TOO_FAST } from './useTutor'

// Asks Bolt, the helper AI of director lessons, for a block. A plain fetch, not useTutor's
// queue: Bolt answers in one JSON reply. Then Sparky gets one turn to reflect (helper_result).
// Sparky-bound events raised during a build (a Run, "I am stuck", a step answer) are held and
// sent after it, in order: a Sparky turn mid-build would write back a board without the block.
export function useBolt(opts: {
  projectId: string
  dispatch: Dispatch<BoardAction>
  boardRef: RefObject<BoardState>
  // Writes the board to the server. Bolt's route and Sparky's turn both read the stored board.
  saveBoard: (b: BoardState) => Promise<void>
  send: (e: ClientEvent) => Promise<void> | void
  say: (text: string) => void
}) {
  const { projectId, dispatch, boardRef, saveBoard, send, say } = opts
  const [building, setBuilding] = useState(false)
  const holding = useRef(false)
  const held = useRef<ClientEvent[]>([])

  // The send every Sparky-bound event goes through.
  const gatedSend = useCallback(
    (e: ClientEvent) => {
      if (holding.current) held.current.push(e)
      else void send(e)
    },
    [send]
  )
  // One at a time, awaited: useTutor keeps one queued event and a second replaces it.
  // Still holding while draining, so an event raised meanwhile waits its turn too.
  const release = useCallback(
    async (first: ClientEvent | null) => {
      if (first) await send(first)
      while (held.current.length) await send(held.current.shift()!)
      holding.current = false
    },
    [send]
  )

  const ask = useCallback(
    async (request: string, pageId: string) => {
      setBuilding(true)
      holding.current = true
      let reply: { op: { node: { id: string } } | null; caption: string } | null = null
      try {
        // The route adds its block to the stored board, so what the student typed goes first.
        await saveBoard(boardRef.current)
        const res = await fetch(`/api/projects/${projectId}/helper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request, pageId }),
        })
        if (!res.ok)
          throw new Error(res.status === 429 ? TOO_FAST : 'Bolt had a problem. Try again.')
        reply = await res.json()
      } catch (err) {
        say(err instanceof Error ? err.message : 'Bolt had a problem. Try again.')
      } finally {
        setBuilding(false)
      }
      // No block (too big, failed, or it would not apply): nothing to wait for.
      let withBlock: BoardState | null = null
      try {
        if (reply) say(`Bolt: ${reply.caption}`)
        // Computed here, not read back after dispatch, so the save cannot miss the block.
        if (reply?.op) withBlock = apply(boardRef.current, reply.op, 'bolt')
      } finally {
        if (!withBlock) void release(null)
      }
      if (!withBlock || !reply?.op) return
      dispatch({ op: reply.op, actor: 'bolt' })
      const nodeId = reply.op.node.id
      // Save the board with the block before Sparky is told: the turn route reads the stored board.
      void saveBoard(withBlock).then(() => release({ type: 'helper_result', nodeId }))
    },
    [projectId, dispatch, boardRef, saveBoard, say, release]
  )

  return { building, ask, send: gatedSend }
}
