import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classEnabledLessons, classMembers, lessonProgress, projects } from '@/lib/db/schema'
import { cached } from '@/lib/cache'
import { LESSONS } from '@/lib/lessons'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { bossesBeaten } from '@/lib/xp'

export type AccessPolicy = 'self-paced' | 'class-only'

// Who opens which lesson, per org. 'self-paced' (B2C, SparkBuild Direct): the
// first lesson is open, and each next lesson opens once the student beats the
// boss of the one before, with no staff step; a class that unlocks lessons
// adds to that and never takes one away. 'class-only' (every school org): the
// school sets the pace, so a student opens only what a class enabled. A
// lesson already started stays resumable either way (LessonsClient locks only
// unstarted ones). D7 adds a paid plan.
export function accessPolicyFor(orgId: string): AccessPolicy {
  return orgId === DIRECT_ORG_ID ? 'self-paced' : 'class-only'
}

// Pure: the lessons a student has reached, walking the catalog in order.
export function selfPacedLessonIds(beaten: Set<number>): number[] {
  const open: number[] = []
  for (const [i, lesson] of LESSONS.entries()) {
    if (i > 0 && !beaten.has(LESSONS[i - 1].id)) break
    open.push(lesson.id)
  }
  return open
}

// Every lesson this student may start: self-paced ∪ class-unlocked in Direct,
// class-unlocked only in a school. orgId is the student's own (the session's).
// Staff bypass this at the call sites.
export async function getAvailableLessonIdsForUser(
  userId: string,
  orgId: string
): Promise<Set<number>> {
  if (accessPolicyFor(orgId) === 'class-only') return getEnabledLessonIdsForUser(userId)

  const [selfPaced, enabled] = await Promise.all([
    getSelfPacedLessonIdsForUser(userId),
    getEnabledLessonIdsForUser(userId),
  ])
  return new Set([...selfPaced, ...enabled])
}

// Uncached: a student who just beat a boss should see the next lesson open on
// the very next page load. Fails closed to the first lesson on a database
// error, so the lesson list still renders.
async function getSelfPacedLessonIdsForUser(userId: string): Promise<number[]> {
  try {
    const rows = await db
      .select({
        lessonId: projects.lessonId,
        lessonVersion: projects.lessonVersion,
        completedTaskIds: lessonProgress.completedTaskIds,
      })
      .from(lessonProgress)
      .innerJoin(projects, eq(projects.id, lessonProgress.projectId))
      .where(eq(projects.userId, userId))
    return selfPacedLessonIds(bossesBeaten(rows))
  } catch (err) {
    console.error('getSelfPacedLessonIdsForUser failed:', err)
    return selfPacedLessonIds(new Set())
  }
}

// A lesson a teacher/admin turned on for at least one class the student is a
// student-member of.
async function getEnabledLessonIdsForUser(userId: string): Promise<Set<number>> {
  // Cached as an array — Sets don't round-trip through JSON. TTL-only, no
  // write-invalidation: this is written from several admin routes affecting
  // a whole class roster at once, and a lesson-unlock gate isn't a security
  // boundary, so a bounded 60s staleness window is an acceptable trade.
  const ids = await cached(`enabled-lessons:${userId}`, 60, async () => {
    // Fails closed on a database error: an empty set is the "nothing
    // unlocked by a class" answer, and the self-paced lessons still show.
    try {
      const rows = await db
        .select({ lessonId: classEnabledLessons.lessonId })
        .from(classMembers)
        .innerJoin(classEnabledLessons, eq(classEnabledLessons.classId, classMembers.classId))
        .where(and(eq(classMembers.userId, userId), eq(classMembers.role, 'student')))

      return rows.map((row) => row.lessonId)
    } catch (err) {
      console.error('getEnabledLessonIdsForUser failed:', err)
      return []
    }
  })

  return new Set(ids)
}
