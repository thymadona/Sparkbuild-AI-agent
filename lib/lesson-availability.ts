import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classEnabledLessons, classMembers } from '@/lib/db/schema'
import { cached } from '@/lib/cache'

// Opt-in: a lesson is available to a student only if a teacher/admin has
// turned it on for at least one class the student is a student-member of.
// A student in no class at all sees nothing available — matches the app's
// existing posture that class membership gates access (see the /no-class
// flow in proxy.ts).
export async function getEnabledLessonIdsForUser(userId: string): Promise<Set<number>> {
  // Cached as an array — Sets don't round-trip through JSON. TTL-only, no
  // write-invalidation: this is written from several admin routes affecting
  // a whole class roster at once, and a lesson-unlock gate isn't a security
  // boundary, so a bounded 60s staleness window is an acceptable trade.
  const ids = await cached(`enabled-lessons:${userId}`, 60, async () => {
    // One join rather than the two round-trips the PostgREST version needed
    // to carry class ids back into a second `.in()` query.
    //
    // Fails closed on a database error: Drizzle throws where the previous
    // client returned `{ data: null }` and this silently produced an empty
    // set, and an empty set is already the "nothing unlocked" answer. The
    // catch keeps that behaviour instead of crashing the lesson list.
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
