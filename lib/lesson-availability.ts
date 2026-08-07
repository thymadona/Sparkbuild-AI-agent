import { supabaseAdmin } from '@/lib/supabase-server'

// Opt-in: a lesson is available to a student only if a teacher/admin has
// turned it on for at least one class the student is a student-member of.
// A student in no class at all sees nothing available — matches the app's
// existing posture that class membership gates access (see the /no-class
// flow in middleware.ts).
export async function getEnabledLessonIdsForUser(userId: string): Promise<Set<number>> {
  const { data: memberships } = await supabaseAdmin
    .from('class_members')
    .select('class_id')
    .eq('user_id', userId)
    .eq('role', 'student')

  const classIds = (memberships ?? []).map((m) => m.class_id)
  if (classIds.length === 0) return new Set()

  const { data: enabled } = await supabaseAdmin
    .from('class_enabled_lessons')
    .select('lesson_id')
    .in('class_id', classIds)

  return new Set((enabled ?? []).map((d) => d.lesson_id))
}
