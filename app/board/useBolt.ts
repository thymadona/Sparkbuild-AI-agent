'use client'

import { useCallback, useState, type Dispatch, type RefObject } from 'react'
import type { BoardAction, BoardState } from '@/lib/board/reducer'
import type { ClientEvent } from '@/lib/tutor/events'
import { TOO_FAST } from './useTutor'

// Asks Bolt, the helper AI of director lessons, for a block. A plain fetch, not useTutor's
// queue: Bolt answers in one JSON reply. Then Sparky gets one turn to reflect (helper_result).
export function useBolt(opts: {
  projectId: string
  dispatch: Dispatch<BoardAction>
  boardRef: RefObject<BoardState>
  // Writes the board to the server. Bolt's route and Sparky's turn both read the stored board.
  saveBoard: (b: BoardState) => Promise<void>
  send: (e: ClientEvent) => void
  say: (text: string) => void
}) {
  const { projectId, dispatch, boardRef, saveBoard, send, say } = opts
  const [building, setBuilding] = useState(false)

  const ask = useCallback(
    async (request: string, pageId: string) => {
      setBuilding(true)
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
      if (!reply) return
      if (reply.op) dispatch({ op: reply.op, actor: 'bolt' })
      say(`Bolt: ${reply.caption}`)
      if (!reply.op) return // too big: no block for Sparky to ask about
      const nodeId = reply.op.node.id
      // The reducer has not run yet in this tick; save the board with the block, then tell Sparky.
      setTimeout(() => {
        void saveBoard(boardRef.current).then(() => send({ type: 'helper_result', nodeId }))
      }, 0)
    },
    [projectId, dispatch, boardRef, saveBoard, send, say]
  )

  return { building, ask }
}
