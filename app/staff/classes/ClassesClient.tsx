'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ClassFormModal, { type PersonOption } from '@/components/admin/ClassFormModal'

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
          <span className="text-xs text-gray-500">Day:</span>
          <button
            onClick={() => setDayFilter(null)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${dayFilter === null ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
          >
            All
          </button>
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => setDayFilter(dayFilter === i ? null : i)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${dayFilter === i ? 'bg-violet-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
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
            className="w-48 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:border-gray-600 focus:outline-none"
          />
          <ClassFormModal mode="create" allTeachers={allTeachers} allStudents={allStudents} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Schedule</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Next Session</th>
              <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Students</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Payment</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((cls) => (
              <tr key={cls.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-100">{cls.name}</div>
                  {cls.description && (
                    <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{cls.description}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {cls.schedules.length === 0 ? (
                    <span className="text-xs text-gray-600">No schedule</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {cls.schedules.map((s, i) => (
                        <span key={i} className="rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                          {DAYS[s.day_of_week]} {formatTime(s.start_time)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {nextSession(cls.schedules)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-md bg-gray-800 px-2.5 py-0.5 text-sm font-medium text-gray-200">
                    {cls.studentCount}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {cls.unpaidCount > 0 && (
                      <span className="rounded-md bg-red-950 border border-red-800 px-2 py-0.5 text-xs text-red-300">
                        {cls.unpaidCount} unpaid
                      </span>
                    )}
                    {cls.paidCount > 0 && (
                      <span className="rounded-md bg-green-950 border border-green-800 px-2 py-0.5 text-xs text-green-300">
                        {cls.paidCount} paid
                      </span>
                    )}
                    {cls.unpaidCount === 0 && cls.paidCount === 0 && (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">
                  {new Date(cls.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/staff/classes/${cls.id}`}
                    className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
                  >
                    Details →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-600">
                  {search || dayFilter !== null ? 'No classes match your filter.' : 'No classes yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">{filtered.length} of {classes.length} classes</p>
    </div>
  )
}
