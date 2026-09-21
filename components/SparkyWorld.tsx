'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { worldState, type SparkyEvent, type WorldState } from '@/lib/sparky-events'

export type Scene = 'robot' | 'vault'

interface Props {
  scene: Scene
  events: SparkyEvent[]
  // Changes on every finished run, so the same events replay again.
  runId: number
}

const W = 320
const H = 200
const DEFAULT_COLOR = '#4cc9f0'
const MAX_LINES = 3
const CHARS = 36

// A finished run is replayed one event at a time, quickly enough that a long
// loop still ends within a few seconds.
const replayDelay = (count: number) => Math.min(800, 5000 / Math.max(count, 1))

function wrap(text: string) {
  const lines: string[] = []
  for (const raw of text.split('\n')) {
    let line = ''
    for (const word of raw.split(' ')) {
      if (line && (line + ' ' + word).length > CHARS) {
        lines.push(line)
        line = word
      } else line = line ? `${line} ${word}` : word
    }
    lines.push(line)
  }
  if (lines.length <= MAX_LINES) return lines
  const kept = lines.slice(0, MAX_LINES)
  kept[MAX_LINES - 1] = kept[MAX_LINES - 1].slice(0, CHARS - 1) + '…'
  return kept
}

function draw(
  ctx: CanvasRenderingContext2D,
  s: WorldState,
  scene: Scene,
  asleep: boolean,
  t: number
) {
  ctx.clearRect(0, 0, W, H)
  // Room
  ctx.fillStyle = '#2b2f4a'
  ctx.fillRect(0, 0, W, 150)
  ctx.fillStyle = '#3d4270'
  ctx.fillRect(0, 150, W, 50)
  ctx.fillStyle = '#4a5088'
  ctx.fillRect(0, 150, W, 3)

  const cx = scene === 'vault' ? 100 : 160

  if (scene === 'vault') {
    ctx.fillStyle = '#6b7390'
    ctx.fillRect(206, 46, 98, 108) // frame
    if (s.door === 'open') {
      ctx.fillStyle = '#0d1020'
      ctx.fillRect(214, 54, 82, 92)
      ctx.fillStyle = `rgba(255, 214, 90, ${0.55 + 0.15 * Math.sin(t / 200)})` // glow
      ctx.fillRect(226, 108, 58, 38)
      ctx.fillStyle = '#ffd65a'
      ctx.fillRect(238, 96, 34, 12)
      ctx.fillStyle = '#aab2c5'
      ctx.fillRect(292, 54, 6, 92) // door swung aside
    } else {
      ctx.fillStyle = '#aab2c5'
      ctx.fillRect(214, 54, 82, 92)
      ctx.fillStyle = '#8f98b0'
      ctx.fillRect(220, 60, 70, 80)
      ctx.fillStyle = '#ffd65a'
      ctx.fillRect(247, 92, 16, 16) // lock
      ctx.fillStyle = '#6b7390'
      ctx.fillRect(251, 96, 8, 8)
    }
  }

  // Sparky
  const bob = Math.round(Math.sin(t / (asleep ? 700 : 300)) * (asleep ? 1 : 2))
  const color = s.color && CSS.supports('color', s.color) ? s.color : DEFAULT_COLOR
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(cx - 28, 154, 56, 6) // shadow
  ctx.save()
  ctx.translate(0, bob)
  ctx.fillStyle = '#1b1e33'
  ctx.fillRect(cx - 32, 78, 64, 82) // outline
  ctx.fillStyle = color
  ctx.fillRect(cx - 20, 118, 40, 36) // body
  ctx.fillRect(cx - 28, 122, 8, 24)
  ctx.fillRect(cx + 20, 122, 8, 24) // arms
  ctx.fillRect(cx - 16, 154, 12, 6)
  ctx.fillRect(cx + 4, 154, 12, 6) // feet
  ctx.fillRect(cx - 24, 82, 48, 34) // head
  ctx.fillStyle = '#1b1e33'
  ctx.fillRect(cx - 2, 68, 4, 14) // antenna
  ctx.fillStyle = s.alarm ? '#ff3b57' : '#ffd65a'
  ctx.fillRect(cx - 6, 62, 12, 8)
  ctx.fillStyle = '#ffffff'
  if (asleep) {
    ctx.fillRect(cx - 16, 98, 10, 3)
    ctx.fillRect(cx + 6, 98, 10, 3) // closed eyes
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px monospace'
    ctx.fillText('z', cx + 30, 76 - ((t / 400) % 3) * 4)
    ctx.fillText('Z', cx + 40, 62 - ((t / 400) % 3) * 4)
  } else {
    const blink = t % 3000 < 120
    ctx.fillRect(cx - 16, 92, 10, blink ? 3 : 12)
    ctx.fillRect(cx + 6, 92, 10, blink ? 3 : 12)
    if (!blink) {
      ctx.fillStyle = '#1b1e33'
      ctx.fillRect(cx - 12, 96, 5, 6)
      ctx.fillRect(cx + 10, 96, 5, 6)
    }
    ctx.fillStyle = '#1b1e33'
    ctx.fillRect(cx - 8, 108, 16, 3) // mouth
  }
  ctx.restore()

  if (s.alarm) {
    ctx.fillStyle = `rgba(255, 40, 60, ${0.14 + 0.14 * Math.sin(t / 150)})`
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#ff3b57'
    ctx.font = 'bold 16px monospace'
    ctx.fillText('ALARM!', 236, 30)
  }

  // Speech bubble
  if (s.say !== null) {
    const lines = wrap(s.say)
    ctx.font = '12px monospace'
    const width = Math.min(W - 8, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16)
    const height = lines.length * 14 + 10
    const x = Math.max(4, Math.min(cx - width / 2, W - 4 - width))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, 4, width, height)
    ctx.fillRect(cx - 4, 4 + height, 8, 4)
    ctx.fillRect(cx - 2, 4 + height + 4, 4, 3) // tail
    ctx.fillStyle = '#1b1e33'
    lines.forEach((l, i) => ctx.fillText(l, x + 8, 4 + 15 + i * 14))
  }
}

export default function SparkyWorld({ scene, events, runId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shown, setShown] = useState(0)
  const stateRef = useRef<WorldState>(worldState([]))
  const asleepRef = useRef(true)

  // Replay each finished run from the start.
  useEffect(() => {
    if (runId === 0) return
    setShown(0)
    const delay = replayDelay(events.length)
    const timers = events.map((_, i) => setTimeout(() => setShown(i + 1), delay * (i + 1)))
    return () => timers.forEach(clearTimeout)
  }, [runId, events])

  const state = useMemo(() => worldState(events.slice(0, shown)), [events, shown])
  useEffect(() => {
    stateRef.current = state
    asleepRef.current = runId === 0
  }, [state, runId])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    let frame = 0
    const loop = (t: number) => {
      draw(ctx, stateRef.current, scene, asleepRef.current, t)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [scene])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      role="img"
      aria-label={state.say ? `Sparky says: ${state.say}` : 'Sparky the robot'}
      className="aspect-[8/5] w-full shrink-0 border-b border-surface-600 bg-[#2b2f4a]"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
