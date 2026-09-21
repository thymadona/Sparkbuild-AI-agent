'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ClassFormModal, { type PersonOption } from '@/components/admin/ClassFormModal'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type ScheduleRow = { day_of_week: number; start_time: string; duration_min: number }
type ClassRow = {
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

export default function ClassesClient({
  classes,
  allTeachers,
  allStudents,
}: {
  classes: ClassRow[]
  allTeachers: PersonOption[]
  allStudents: PersonOption[]
}) {
  const [dayFilter, setDayFilter] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return classes.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      if (dayFilter !== null && !c.schedules.some((s) => s.day_of_week === dayFilter)) return false
      return true
    })
  }, [classes, search, dayFilter])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Day:</span>
          <button
            onClick={() => setDayFilter(null)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${dayFilter === null ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All
          </button>
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => setDayFilter(dayFilter === i ? null : i)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${dayFilter === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes…"
            className="w-48 rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <ClassFormModal mode="create" allTeachers={allTeachers} allStudents={allStudents} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Next Session</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{cls.name}</div>
                  {cls.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                      {cls.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {cls.schedules.length === 0 ? (
                    <span className="text-xs text-muted-foreground/70">No schedule</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {cls.schedules.map((s, i) => (
                        <Badge key={i} variant="secondary">
                          {DAYS[s.day_of_week]} {formatTime(s.start_time)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {nextSession(cls.schedules)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">
                  {cls.studentCount}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    {cls.unpaidCount > 0 && (
                      <Badge variant="destructive">{cls.unpaidCount} unpaid</Badge>
                    )}
                    {cls.paidCount > 0 && <Badge variant="success">{cls.paidCount} paid</Badge>}
                    {cls.unpaidCount === 0 && cls.paidCount === 0 && (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(cls.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/staff/classes/${cls.id}`}
                    className="rounded bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
                  >
                    Details →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground/70"
                >
                  {search || dayFilter !== null
                    ? 'No classes match your filter.'
                    : 'No classes yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground/70">
        {filtered.length} of {classes.length} classes
      </p>
    </div>
  )
}
