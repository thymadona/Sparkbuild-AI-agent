'use client'

import { GraduationCapIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type ScheduleRow = { day_of_week: number; start_time: string; duration_min: number }
export type ClassRow = {
  id: string
  name: string
  description: string | null
  createdAt: string
  studentCount: number
  schedules: ScheduleRow[]
  paidCount: number
  unpaidCount: number
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function nextSession(schedules: ScheduleRow[]): string {
  if (schedules.length === 0) return '—'
  const now = new Date()
  const today = now.getDay()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  // Find the soonest upcoming slot
  let best: { daysAway: number; day: number; time: string } | null = null
  for (const s of schedules) {
    const [h, m] = s.start_time.split(':').map(Number)
    const slotMins = h * 60 + m
    let daysAway = (s.day_of_week - today + 7) % 7
    if (daysAway === 0 && slotMins <= nowMins) daysAway = 7
    if (!best || daysAway < best.daysAway) {
      best = { daysAway, day: s.day_of_week, time: s.start_time }
    }
  }
  if (!best) return '—'
  if (best.daysAway === 0) return `Today ${formatTime(best.time)}`
  if (best.daysAway === 1) return `Tomorrow ${formatTime(best.time)}`
  return `${DAYS[best.day]} ${formatTime(best.time)}`
}

// The admin's class list. Creating a class is the page header's button.
export default function ClassesClient({ classes }: { classes: ClassRow[] }) {
  return (
    <DataTable
      rows={classes}
      getRowId={(c) => c.id}
      rowHref={(c) => `/staff/classes/${c.id}`}
      noun="classes"
      emptyText="No classes yet."
      search={{ placeholder: 'Search classes', text: (c) => `${c.name} ${c.description ?? ''}` }}
      filters={[
        {
          id: 'day',
          label: 'Day',
          options: [
            { value: 'all', label: 'Any day' },
            ...DAYS.map((d, i) => ({ value: String(i), label: d })),
            { value: 'none', label: 'No schedule' },
          ],
          match: (c, v) =>
            v === 'none'
              ? c.schedules.length === 0
              : c.schedules.some((s) => s.day_of_week === Number(v)),
        },
        {
          id: 'payment',
          label: 'Payment',
          options: [
            { value: 'all', label: 'All' },
            { value: 'unpaid', label: 'Has unpaid' },
            { value: 'paid', label: 'All paid' },
          ],
          match: (c, v) =>
            v === 'unpaid' ? c.unpaidCount > 0 : c.unpaidCount === 0 && c.paidCount > 0,
        },
      ]}
      columns={[
        {
          id: 'name',
          header: 'Class',
          sortValue: (c) => c.name.toLowerCase(),
          cell: (c) => (
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <GraduationCapIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{c.name}</div>
                {c.description && (
                  <div className="max-w-xs truncate text-xs text-muted-foreground">
                    {c.description}
                  </div>
                )}
              </div>
            </div>
          ),
        },
        {
          id: 'schedule',
          header: 'Schedule',
          cell: (c) =>
            c.schedules.length === 0 ? (
              <span className="text-xs text-muted-foreground/70">No schedule</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {c.schedules.map((s, i) => (
                  <Badge key={i} variant="secondary">
                    {DAYS[s.day_of_week]} {formatTime(s.start_time)}
                  </Badge>
                ))}
              </div>
            ),
        },
        {
          id: 'next',
          header: 'Next session',
          cell: (c) => <span className="text-muted-foreground">{nextSession(c.schedules)}</span>,
        },
        {
          id: 'students',
          header: 'Students',
          className: 'text-right',
          sortValue: (c) => c.studentCount,
          cell: (c) => <span className="font-medium tabular-nums">{c.studentCount}</span>,
        },
        {
          id: 'payment',
          header: 'Payment',
          sortValue: (c) => c.unpaidCount,
          cell: (c) => (
            <div className="flex gap-1.5">
              {c.unpaidCount > 0 && <Badge variant="destructive">{c.unpaidCount} unpaid</Badge>}
              {c.paidCount > 0 && <Badge variant="success">{c.paidCount} paid</Badge>}
              {c.unpaidCount === 0 && c.paidCount === 0 && (
                <span className="text-xs text-muted-foreground/70">—</span>
              )}
            </div>
          ),
        },
        {
          id: 'created',
          header: 'Created',
          className: 'text-right',
          sortValue: (c) => c.createdAt,
          cell: (c) => (
            <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
          ),
        },
      ]}
    />
  )
}
