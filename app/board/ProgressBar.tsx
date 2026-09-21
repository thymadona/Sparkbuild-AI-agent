'use client'

import { useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'

// Sticky lesson strip above the page: tasks finished and XP earned in this lesson.
// When XP grows, the count pops, a "+N" floats up and the bar gets a shine (see globals.css).
export default function ProgressBar({ done, total, xp }: { done: number; total: number; xp: number }) {
  const prev = useRef(xp)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  if (xp !== prev.current) {
    if (xp > prev.current) setGain({ n: xp - prev.current, key: Date.now() })
    prev.current = xp
  }

  return (
    <div className="shrink-0 border-b border-[#e4d9c5] px-6 py-3 md:px-12">
      <div className="mx-auto flex max-w-2xl items-center gap-4">
        <div
          role="progressbar"
          aria-label={`${done} of ${total} tasks done`}
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          className="h-3 flex-1 overflow-hidden rounded-full bg-[#e4d9c5]"
        >
          <div
            className="relative h-full overflow-hidden rounded-full bg-teal-500 transition-[width] duration-500"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          >
            {/* keyed so the shine replays on every gain without remounting the bar (which would skip its width transition) */}
            {gain && <span key={gain.key} className="bar-shine absolute inset-0" />}
          </div>
        </div>
        <span className="relative flex items-center gap-1 text-base font-bold text-[#5c4f3d]">
          <span key={`n${gain?.key}`} className={gain ? 'xp-pop inline-block' : 'inline-block'}>{xp}</span>
          <Sparkles key={`s${gain?.key}`} className={`size-5 text-teal-500 ${gain ? 'xp-pop' : ''}`} aria-hidden="true" />
          <span className="sr-only">XP</span>
          {gain && (
            <span key={gain.key} aria-hidden="true" className="xp-float pointer-events-none absolute -top-1 right-0 text-sm font-bold text-teal-600">
              +{gain.n}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
