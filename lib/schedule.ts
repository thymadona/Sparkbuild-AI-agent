/**
 * Homework is due before the student's next class.
 *
 * The due date is derived from `class_schedules` rather than stored on the
 * project: the schedule is already the source of truth for when a class meets,
 * and a copied date would drift the moment a class is rescheduled.
 *
 * These functions run in the browser on purpose. `start_time` is a wall-clock
 * time with no zone, so it has to be resolved against the student's own clock —
 * resolving it on the server would use the host's timezone (UTC in most
 * deployments) and could name the wrong day.
 */

export interface ClassSlot {
  day_of_week: number // 0=Sun … 6=Sat
  start_time: string // 'HH:MM' or 'HH:MM:SS'
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseTime(startTime: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(startTime.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

/** The soonest class meeting strictly after `from`, or null if there is none. */
export function nextClassMeeting(slots: ClassSlot[], from: Date = new Date()): Date | null {
  let soonest: Date | null = null

  for (const slot of slots) {
    if (!Number.isInteger(slot.day_of_week) || slot.day_of_week < 0 || slot.day_of_week > 6) continue
    const time = parseTime(slot.start_time)
    if (!time) continue

    const daysAhead = (slot.day_of_week - from.getDay() + 7) % 7
    const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate() + daysAhead, time.hours, time.minutes, 0, 0)
    // A slot earlier today has already happened; the next one is next week.
    if (candidate.getTime() <= from.getTime()) candidate.setTime(candidate.getTime() + 7 * DAY_MS)

    if (!soonest || candidate.getTime() < soonest.getTime()) soonest = candidate
  }

  return soonest
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Short, kid-readable deadline. Null when the student has no class scheduled. */
export function dueLabel(meeting: Date | null, from: Date = new Date()): string | null {
  if (!meeting) return null

  if (sameDay(meeting, from)) return 'Hand in today, before class.'

  const tomorrow = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  if (sameDay(meeting, tomorrow)) return 'Hand in by tomorrow.'

  const weekday = meeting.toLocaleDateString(undefined, { weekday: 'long' })
  return `Hand in before ${weekday}.`
}
