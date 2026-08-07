import { supabaseAdmin } from '@/lib/supabase-server'

// A lesson is unavailable to a student if a teacher/admin has disabled it
// for ANY class the student is a student-member of — the conservative
// reading of "turned off," so a teacher's "not yet" always wins over
// another class the student might also belong to.
export async function getDisabledLessonIdsForUser(userId: string): Promise<Set<number>> {
  const { data: memberships } = await supabaseAdmin
    .from('class_members')
    .select('class_id')
    .eq('user_id', userId)
    .eq('role', 'student')

  const classIds = (memberships ?? []).map((m) => m.class_id)
  if (classIds.length === 0) return new Set()

  const { data: disabled } = await supabaseAdmin
    .from('class_disabled_lessons')
    .select('lesson_id')
    .in('class_id', classIds)

  return new Set((disabled ?? []).map((d) => d.lesson_id))
}
