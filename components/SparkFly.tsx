'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

export interface SparkFlyTrigger {
  // Unique per flight so a repeat "Show me" click (same origin/dest) still
  // re-fires — same trigger-changes-to-refire pattern as ConfettiBurst.
  id: string
  origin: { x: number; y: number }
  dest: { x: number; y: number }
}

interface SparkFlyProps {
  trigger: SparkFlyTrigger | null
}

const TRAVEL_MS = 450
const FADE_DELAY_MS = 250
const FADE_MS = 300
const TOTAL_MS = TRAVEL_MS + FADE_DELAY_MS + FADE_MS

/**
 * A single spark icon that flies from an origin point to a destination point,
 * then settles into a brief pulse and fades. Purely a screen-space overlay —
 * it cannot animate across the sandboxed preview iframe's boundary, so it
 * only ever flies within the parent document (to the code editor target);
 * the preview's own highlight (see Preview.tsx's `pointAt`) is a separate,
 * synced pulse rather than a second flight.
 */
export default function SparkFly({ trigger }: SparkFlyProps) {
  const [state, setState] = useState<{ trigger: SparkFlyTrigger; arrived: boolean } | null>(null)

  useEffect(() => {
    if (!trigger) return
    setState({ trigger, arrived: false })
    // A tick after mount, so the origin position actually paints before the
    // transition to dest starts (otherwise both commit in the same frame).
    const arrive = setTimeout(
      () => setState((s) => (s && s.trigger.id === trigger.id ? { ...s, arrived: true } : s)),
      20
    )
    const clear = setTimeout(() => setState((s) => (s?.trigger.id === trigger.id ? null : s)), TOTAL_MS)
    return () => {
      clearTimeout(arrive)
      clearTimeout(clear)
    }
  }, [trigger])

  if (!state) return null
  const pos = state.arrived ? state.trigger.dest : state.trigger.origin

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[60] text-secondary"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(${state.arrived ? 1.4 : 1})`,
        opacity: state.arrived ? 0 : 1,
        transition: state.arrived
          ? `transform ${TRAVEL_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${FADE_MS}ms ease ${FADE_DELAY_MS}ms`
          : `transform ${TRAVEL_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
      }}
      aria-hidden="true"
    >
      <Sparkles className="h-6 w-6 drop-shadow" fill="currentColor" />
    </div>
  )
}
