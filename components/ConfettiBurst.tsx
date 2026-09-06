'use client'

import { useEffect, useState } from 'react'

const COLORS = ['#f97316', '#facc15', '#22c55e', '#38bdf8', '#a78bfa', '#f472b6']
const PARTICLE_COUNT = 28
const BIG_PARTICLE_COUNT = 70
// Longer than the longest particle animation, so nothing is cut off mid-fall.
const BURST_MS = 1600
const BIG_BURST_MS = 2200

interface Particle {
  id: number
  left: number
  color: string
  delay: number
  duration: number
  drift: number
  rotate: number
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    color: COLORS[id % COLORS.length],
    delay: Math.random() * 0.15,
    duration: 0.9 + Math.random() * 0.6,
    drift: (Math.random() - 0.5) * 160,
    rotate: 180 + Math.random() * 540,
  }))
}

interface ConfettiBurstProps {
  // Any change to this value fires a new burst — e.g. the id of the task
  // that was just completed, made unique per completion.
  trigger: string | null
  // 'big' is for the all-tasks-done moment — more particles, longer burst —
  // so it reads as clearly bigger than a per-task burst, not just a repeat.
  size?: 'normal' | 'big'
}

/**
 * A short confetti burst with no external dependency — a fistful of colored
 * divs falling with CSS, unmounted once the animation ends.
 */
export default function ConfettiBurst({ trigger, size = 'normal' }: ConfettiBurstProps) {
  const [particles, setParticles] = useState<Particle[] | null>(null)
  const burstMs = size === 'big' ? BIG_BURST_MS : BURST_MS

  useEffect(() => {
    if (!trigger) return
    setParticles(makeParticles(size === 'big' ? BIG_PARTICLE_COUNT : PARTICLE_COUNT))
    const timer = setTimeout(() => setParticles(null), burstMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  if (!particles) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="confetti-particle absolute top-0 block h-2.5 w-1.5 rounded-sm"
          style={{
            left: `${particle.left}%`,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            '--confetti-drift': `${particle.drift}px`,
            '--confetti-rotate': `${particle.rotate}deg`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        .confetti-particle {
          animation-name: confetti-fall;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
        @keyframes confetti-fall {
          0% { transform: translate(0, -10px) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--confetti-drift), 100vh) rotate(var(--confetti-rotate)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
