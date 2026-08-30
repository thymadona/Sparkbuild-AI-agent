import { supabaseAdmin } from '@/lib/supabase-server'
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
    const { data: memberships } = await supabaseAdmin
      .from('class_members')
      .select('class_id')
      .eq('user_id', userId)
      .eq('role', 'student')

    const classIds = (memberships ?? []).map((m) => m.class_id)
    if (classIds.length === 0) return []

    const { data: enabled } = await supabaseAdmin
      .from('class_enabled_lessons')
      .select('lesson_id')
      .in('class_id', classIds)

    return (enabled ?? []).map((d) => d.lesson_id)
  })

  return new Set(ids)
}
