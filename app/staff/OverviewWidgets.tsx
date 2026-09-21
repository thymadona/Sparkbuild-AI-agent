import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import type { SubmissionStatus } from '@/types'

// Shared presentational pieces for OverviewTab (admin) and TeacherOverviewTab
// (teacher) — both route-colocated under app/staff/, not promoted to
// components/ since nothing outside this segment uses them.

// A compact inline stat, for a row of roster numbers that don't need a whole
// tile — the Command Center overview demotes these below the hero metric.
export function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-sm text-muted-foreground">
      <strong className="font-semibold text-foreground tabular-nums">
        {value.toLocaleString()}
      </strong>{' '}
      {label}
    </span>
  )
}

// A row of proportionally-heighted bars — no charting dependency, same
// div/CSS approach as Meter/MagnitudeBar below.
export function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-10 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max((v / max) * 100, v > 0 ? 8 : 3)}%` }}
        />
      ))}
    </div>
  )
}

// The one-hero-metric-plus-trend that leads the redesigned Overview.
export function HeroMetric({
  label,
  value,
  sub,
  trend,
}: {
  label: string
  value: string
  sub?: string
  trend: number[]
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full items-end justify-between gap-6">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-4xl font-bold text-foreground tabular-nums">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className="w-28 shrink-0 sm:w-40">
          <Sparkline values={trend} />
        </div>
      </CardContent>
    </Card>
  )
}

export interface AttentionItem {
  href: string
  label: string
  count: number
  detail?: string
}

// Unified "needs attention" feed — replaces a separate stat-tile grid with
// one list of real, actionable signals; nothing renders when there's nothing
// to act on.
export function AttentionFeed({ items }: { items: AttentionItem[] }) {
  const active = items.filter((item) => item.count > 0)

  if (active.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center text-sm text-muted-foreground">
          All caught up — nothing needs attention.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardContent className="divide-y divide-border p-0">
        {active.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors first:rounded-t-md last:rounded-b-md hover:bg-muted/50"
          >
            <span className="text-sm text-foreground">{item.label}</span>
            <span className="flex items-center gap-2">
              {item.detail && (
                <span className="text-xs font-medium text-destructive">{item.detail}</span>
              )}
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {item.count}
              </span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

// A ratio against a fixed limit (0–100%) reads as a meter, not a generic bar —
// same-ramp track + fill, one hue, value labeled at the tip.
export function Meter({ label, pct, count }: { label: string; pct: number; count: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {count} · <span className="font-medium text-foreground">{pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Plain magnitude comparison across classes — no fixed ceiling, so the bar is
// scaled to the largest value in the set rather than to 100%.
export function MagnitudeBar({
  label,
  value,
  max,
  href,
}: {
  label: string
  value: number
  max: number
  href: string
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0
  return (
    <Link href={href} className="block group">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground group-hover:text-primary transition-colors">{label}</span>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {value.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-success/80 group-hover:bg-success transition-colors"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  )
}

export const STATUS_META: Record<SubmissionStatus, { label: string; className: string }> = {
  submitted: { label: 'Waiting for review', className: 'bg-warning' },
  approved: { label: 'Approved', className: 'bg-success' },
  needs_work: { label: 'Sent back', className: 'bg-destructive' },
}

// Part-to-whole across a fixed status set — a segmented bar, colored by
// status (never a generic categorical hue) with a legend and its counts.
export function StatusBar({ counts }: { counts: Record<SubmissionStatus, number> }) {
  const total = counts.submitted + counts.approved + counts.needs_work
  const order: SubmissionStatus[] = ['submitted', 'approved', 'needs_work']

  return (
    <div>
      {total === 0 ? (
        <div className="h-2.5 rounded-full bg-muted" />
      ) : (
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {order.map((status) =>
            counts[status] > 0 ? (
              <div
                key={status}
                className={STATUS_META[status].className}
                style={{ width: `${(counts[status] / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {order.map((status) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[status].className}`} />
            {STATUS_META[status].label}
            <span className="font-medium text-foreground">{counts[status]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
