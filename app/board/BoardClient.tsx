'use client'

import { useEffect, useReducer, useState } from 'react'
import { boardReducer, emptyBoard } from '@/lib/board/reducer'
import BoardView from './BoardView'
import { fixture } from './fixture'
import type { MascotState } from './Mascot'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Scripted demo: replays fixture.ts with no tutor behind it.
export default function BoardClient() {
  const [board, dispatch] = useReducer(boardReducer, undefined, emptyBoard)
  const [captions, setCaptions] = useState<string[]>([])
  const [live, setLive] = useState('')
  const [mascot, setMascot] = useState<MascotState>('idle')
  const [run, setRun] = useState(0)

  useEffect(() => {
    let dead = false
    dispatch({ reset: emptyBoard() })
    setCaptions([])
    ;(async () => {
      for (const step of fixture) {
        if (dead) return
        if (step.caption) {
          setMascot('speaking')
          let text = ''
          for (const w of step.caption.split(' ')) {
            if (dead) return
            text += (text ? ' ' : '') + w
            setLive(text)
            await sleep(60)
          }
          setCaptions((c) => [...c, step.caption!])
          setLive('')
        }
        for (const op of step.client ?? []) dispatch({ op, actor: 'client' })
        for (const op of step.ops ?? []) dispatch({ op, actor: 'tutor' })
        setMascot('thinking')
        await sleep(step.wait ?? 700)
      }
      if (!dead) setMascot('celebrating')
    })().catch(console.error)
    return () => { dead = true }
  }, [run])

  return <BoardView board={board} captions={captions} live={live} mascot={mascot} onReplay={() => setRun((n) => n + 1)} />
}
