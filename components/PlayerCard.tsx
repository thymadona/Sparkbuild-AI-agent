import { Zap } from 'lucide-react'
import { LEVELS, type PlayerStats } from '@/lib/xp'

// Level, XP bar, streak and badges. Plain markup so it works in server and
// client trees alike.
export default function PlayerCard({ stats }: { stats: PlayerStats }) {
  const { level, xp, streak, badges } = stats
  const pct = level.span ? Math.round((level.into / level.span) * 100) : 100
  const levelIndex = LEVELS.findIndex((l) => l.name === level.name)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 bg-tint-sand p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-surface-600 bg-spark text-white shadow-hard-sm">
            <Zap className="size-6 fill-current" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
              Your level
            </p>
            <p className="font-display text-3xl font-extrabold leading-tight text-fg-primary">
              {level.name}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 shadow-hard-sm"
          title="Days in a row you worked on a lesson"
        >
          <span aria-hidden="true">🔥</span>
          <span className="font-display text-sm font-bold text-fg-primary">
            {streak} {streak === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between text-sm font-bold text-fg-primary">
          <span className="flex items-center gap-1 font-display">
            <Zap className="size-4 fill-current text-spark" aria-hidden="true" />
            {xp} XP
          </span>
          <span className="text-xs font-semibold text-fg-secondary">
            {level.next ? `${level.span - level.into} to ${level.next}` : 'Top level!'}
          </span>
        </div>
        <div
          className="mt-2 h-4 overflow-hidden rounded-full bg-muted shadow-inner"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="XP to next level"
        >
          <div
            className="bar-shine relative h-full overflow-hidden rounded-full bg-spark transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ol className="mt-3 flex gap-1.5" aria-label="Levels">
          {LEVELS.map((l, i) => (
            <li
              key={l.name}
              title={`${l.name} · ${l.xp} XP`}
              className={`h-1.5 flex-1 rounded-full ${i <= levelIndex ? 'bg-spark' : 'bg-border'}`}
            />
          ))}
        </ol>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Badges</p>
          {badges.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <li
                  key={badge}
                  className="rounded-full bg-tint-sand px-3 py-1 text-sm font-bold text-fg-primary"
                >
                  🏅 {badge}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-border px-3 py-3 text-center text-sm text-fg-muted">
              🏅 Beat a boss to win your first badge.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
