import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activityDays, lessonProgress, projects } from '@/lib/db/schema'
import { badgesFor, levelFor, streakFor, todayISO, xpFor, type PlayerStats } from '@/lib/xp'

const EMPTY: PlayerStats = { xp: 0, level: levelFor(0), streak: 0, badges: [] }

// Fails open: the game layer must never take a page down.
export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  try {
    return await readPlayerStats(userId)
  } catch (err) {
    console.error('getPlayerStats failed:', err)
    return EMPTY
  }
}

async function readPlayerStats(userId: string): Promise<PlayerStats> {
  const [rows, days] = await Promise.all([
    db
      .select({
        lessonId: projects.lessonId,
        lessonVersion: projects.lessonVersion,
        completedTaskIds: lessonProgress.completedTaskIds,
      })
      .from(lessonProgress)
      .innerJoin(projects, eq(projects.id, lessonProgress.projectId))
      .where(eq(projects.userId, userId)),
    // A streak longer than a year still reads as "a year+", so cap the scan.
    db
      .select({ day: activityDays.day })
      .from(activityDays)
      .where(eq(activityDays.userId, userId))
      .orderBy(desc(activityDays.day))
      .limit(400),
  ])
  const xp = xpFor(rows)
  return {
    xp,
    level: levelFor(xp),
    streak: streakFor(
      days.map((d) => d.day),
      todayISO()
    ),
    badges: badgesFor(rows),
  }
}

export async function recordActivity(userId: string) {
  await db.insert(activityDays).values({ userId, day: todayISO() }).onConflictDoNothing()
}
