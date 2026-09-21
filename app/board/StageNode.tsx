'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BoardNode } from '@/lib/board/schema'
import { runProgram, sceneWon, type Block, type SceneId } from '@/lib/board/scenes'
import type { BoxesConfig, BoxesState } from '@/lib/board/scenes/boxes'
import type { GridConfig, GridState } from '@/lib/board/scenes/grid'
import type { MachineConfig, MachineState } from '@/lib/board/scenes/machine'
import type { RoomState } from '@/lib/board/scenes/room'
import { cn } from '@/lib/utils'
import type { CodeActions } from './Nodes'
import BoxesView from './scenes/BoxesView'
import GridView from './scenes/GridView'
import MachineView from './scenes/MachineView'
import RoomView from './scenes/RoomView'

type Stage = Extract<BoardNode, { type: 'stage' }>

const FRAME_MS = 550
const MAX_MISSES = 3 // then a working program is shown, so nobody is stuck
const MAX_BLOCKS = 8

function SceneView({ node, state, frame }: { node: Stage; state: unknown; frame: number }) {
  switch (node.scene) {
    case 'room': return <RoomView state={state as RoomState} frame={frame} />
    case 'grid': return <GridView state={state as GridState} config={node.config as unknown as GridConfig} />
    case 'boxes': return <BoxesView state={state as BoxesState} config={node.config as unknown as BoxesConfig} />
    case 'machine': return <MachineView state={state as MachineState} config={node.config as unknown as MachineConfig} />
  }
}

// A live scene with a tap-the-blocks program. Tap blocks into the list, press Run, watch it play.
export default function StageNode({ node, code }: { node: Stage; code?: CodeActions }) {
  const scene = node.scene as SceneId
  const palette = node.palette as Block[]
  const [playing, setPlaying] = useState<number | null>(null) // index into `states` while a run plays
  const [missed, setMissed] = useState(false)
  const states = useMemo(() => runProgram(scene, node.config, palette, node.program), [scene, node.config, palette, node.program])
  const won = node.answered && sceneWon(scene, states.at(-1), node.goal)
  const shown = playing !== null ? states[Math.min(playing, states.length - 1)] : node.answered ? states.at(-1) : states[0]
  const locked = !code || node.answered || playing !== null

  // Play the run one op at a time, then judge the last state.
  useEffect(() => {
    if (playing === null || !code) return
    if (playing < states.length - 1) {
      const t = setTimeout(() => setPlaying(playing + 1), FRAME_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setPlaying(null)
      const attempts = node.attempts + 1
      if (sceneWon(scene, states.at(-1), node.goal)) return code.patch(node.id, { attempts, answered: true })
      setMissed(true)
      code.feedback?.({ type: 'stage_result', nodeId: node.id, prompt: node.prompt, program: node.program.map((i) => palette[i].label), attempts })
      code.patch(node.id, attempts >= MAX_MISSES ? { attempts, answered: true, program: node.solution } : { attempts })
    }, FRAME_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- steps forward on `playing` only
  }, [playing])

  const add = (i: number) => { setMissed(false); code?.patch(node.id, { program: [...node.program, i] }) }
  const remove = (at: number) => { setMissed(false); code?.patch(node.id, { program: node.program.filter((_, k) => k !== at) }) }
  const run = () => { setMissed(false); setPlaying(0) }

  return (
    <div className="rounded-xl border border-[#e4d9c5] p-4 space-y-3">
      <p className="font-semibold">{node.prompt}</p>
      <SceneView node={node} state={shown} frame={playing ?? 0} />
      <ol className="min-h-11 space-y-1 rounded-lg border-2 border-dashed border-[#d9c9ab] p-2" aria-label="Your program">
        {node.program.length === 0 && <li className="px-2 py-1 text-sm text-[#5c4f3d]">Tap blocks to build your program.</li>}
        {node.program.map((i, at) => (
          <li key={at} className="flex items-center gap-2">
            <span className="w-5 text-right text-sm text-[#5c4f3d]" aria-hidden="true">{at + 1}</span>
            <button disabled={locked} onClick={() => remove(at)} aria-label={`Remove ${palette[i].label}`} className="min-h-9 rounded-lg border-2 border-[#d9c9ab] bg-white px-3 font-mono text-sm font-semibold hover:bg-red-50 disabled:hover:bg-white">{palette[i].label}</button>
          </li>
        ))}
      </ol>
      {!node.answered && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Blocks">
          {palette.map((b, i) => (
            <button key={i} disabled={locked || node.program.length >= MAX_BLOCKS} onClick={() => add(i)} className={cn('min-h-11 rounded-lg border-2 border-[#2b2118] bg-[#2b2118] px-4 font-mono text-sm font-semibold text-[#f3e9d8] hover:bg-[#3b2a1c] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50')}>{b.label}</button>
          ))}
        </div>
      )}
      {!node.answered && (
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={locked || node.program.length === 0} onClick={run} className="min-h-11 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white disabled:opacity-50">▶ Run</button>
          <button disabled={locked || node.program.length === 0} onClick={() => { setMissed(false); code?.patch(node.id, { program: [] }) }} className="min-h-11 rounded-full border-2 border-[#d9c9ab] px-4 text-sm font-semibold hover:bg-[#e4d3b3] disabled:opacity-50">↻ Start over</button>
        </div>
      )}
      <p aria-live="polite" className="min-h-6 text-sm">
        {node.answered ? <span className="text-teal-800">{won && node.attempts < MAX_MISSES ? 'You did it!' : won ? 'Here is one way to do it.' : 'Nice try!'}</span> : missed ? <span className="text-red-800">Not yet. Watch what happened. Try again.</span> : null}
      </p>
    </div>
  )
}
