import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import { getEnabledLessonIdsForUser } from '@/lib/lesson-availability'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import LessonsClient from './LessonsClient'

export default async function LessonsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const [{ data: userProjects }, enabledLessonIds, admin, teacher] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, lesson_id, updated_at')
      .eq('user_id', user.id)
      .not('lesson_id', 'is', null)
      .order('updated_at', { ascending: false }),
    getEnabledLessonIdsForUser(user.id),
    isAdmin(user.id),
    isTeacher(user.id),
  ])

  // Admins and teachers previewing the catalog aren't gated by the
  // per-class toggle — that toggle exists to control student access, and a
  // teacher assigned to no class (or none yet) should still see and open
  // lessons — same posture as rate limiting.
  const enabledIds = admin || teacher ? LESSONS.map((l) => l.id) : Array.from(enabledLessonIds)

  return (
    <LessonsClient
      lessons={LESSONS}
      userProjects={userProjects ?? []}
      enabledLessonIds={enabledIds}
      userEmail={user.email ?? ''}
    />
  )
}
