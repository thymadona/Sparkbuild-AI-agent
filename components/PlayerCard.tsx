import type { PlayerStats } from '@/lib/xp'

// Level, XP bar, streak and badges. Plain markup so it works in server and
// client trees alike.
export default function PlayerCard({ stats }: { stats: PlayerStats }) {
  const { level, xp, streak, badges } = stats
  const pct = level.span ? Math.round((level.into / level.span) * 100) : 100
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
            Your level
          </p>
          <p className="font-display text-2xl font-bold text-fg-primary">{level.name}</p>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5"
          title="Days in a row you worked on a lesson"
        >
          <span aria-hidden="true">🔥</span>
          <span className="font-display text-sm font-bold text-fg-primary">
            {streak} {streak === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>

      <div
        className="mt-4 h-2.5 rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="XP to next level"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-fg-secondary">
        {xp} XP · {level.next ? `${level.span - level.into} more to ${level.next}` : 'Top level!'}
      </p>

      <div className="mt-4">
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
          <p className="mt-1 text-sm text-fg-muted">Beat a boss to win your first badge.</p>
        )}
      </div>
    </div>
  )
}
