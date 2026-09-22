import { getLessonForProject, hasCompletedTask, type Lesson, type LessonTask } from './lessons'

// The game layer. XP, levels and badges are pure functions of the student's
// saved task progress and the lesson catalog, so there is nothing to store or
// keep in sync. Only the streak needs its own table (activity_days).
//
// Not built yet: the +5 "solo" and +5 "predict" bonuses from the plan. They
// need per-task data (hint used, first-try guess) that progress does not keep.

export const XP_PER_TASK = { core: 10, choice: 15, bonus: 20, homework: 15 } as const
export const XP_BOSS = 40

export const LEVELS = [
  { name: 'Rookie', xp: 0 },
  { name: 'Coder', xp: 100 },
  { name: 'Scripter', xp: 250 },
  { name: 'Debugger', xp: 450 },
  { name: 'Agent', xp: 750 },
  { name: 'Director', xp: 1100 },
  { name: 'Studio Head', xp: 1700 },
] as const

export const taskXp = (task: LessonTask) => (task.boss ? XP_BOSS : XP_PER_TASK[task.type])

export interface ProgressRow {
  lessonId: number | null
  lessonVersion: number | null
  completedTaskIds: string[]
}

// One lesson can have several projects (duplicates); a task counts once.
function doneByLesson(rows: ProgressRow[]) {
  const done = new Map<string, { lesson: Lesson; ids: Set<string> }>()
  for (const row of rows) {
    // Progress rows from the retired web course resolve to no lesson and earn nothing.
    if (row.lessonId === null) continue
    const lesson = getLessonForProject(row.lessonId, row.lessonVersion)
    if (!lesson) continue
    const key = `${row.lessonVersion}:${row.lessonId}`
    const entry = done.get(key) ?? { lesson, ids: new Set<string>() }
    for (const id of row.completedTaskIds) entry.ids.add(id)
    done.set(key, entry)
  }
  return [...done.values()]
}

export function xpFor(rows: ProgressRow[]): number {
  let total = 0
  for (const { lesson, ids } of doneByLesson(rows)) {
    for (const task of lesson.tasks) if (hasCompletedTask(ids, task.id)) total += taskXp(task)
  }
  return total
}

// A lesson's badge is earned by beating its boss task.
export function badgesFor(rows: ProgressRow[]): string[] {
  return doneByLesson(rows).flatMap(({ lesson, ids }) => {
    const boss = lesson.tasks.find((t) => t.boss)
    return lesson.badge && boss && hasCompletedTask(ids, boss.id) ? [lesson.badge] : []
  })
}

export interface PlayerStats {
  xp: number
  level: ReturnType<typeof levelFor>
  streak: number
  badges: string[]
}

export function levelFor(xp: number) {
  let index = 0
  for (const [i, level] of LEVELS.entries()) if (xp >= level.xp) index = i
  const current = LEVELS[index]
  const next = LEVELS[index + 1] ?? null
  return {
    name: current.name,
    next: next?.name ?? null,
    // XP earned inside this level, and how much the level is worth.
    into: xp - current.xp,
    span: next ? next.xp - current.xp : 0,
  }
}

// Consecutive days of activity ending today. A streak stays alive through
// yesterday, so it only breaks once a whole day passes with no work.
export function streakFor(days: string[], today: string): number {
  const set = new Set(days)
  const step = (iso: string, by: number) => {
    const d = new Date(`${iso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + by)
    return d.toISOString().slice(0, 10)
  }
  let cursor = set.has(today) ? today : step(today, -1)
  let count = 0
  while (set.has(cursor)) {
    count++
    cursor = step(cursor, -1)
  }
  return count
}

// Today's date in the school's timezone. UTC by default; a kid working before
// UTC midnight-plus-offset would otherwise land on the wrong day.
// ponytail: one timezone for everyone, per-user zones if classes span regions.
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'UTC' }).format(
    now
  )
}
