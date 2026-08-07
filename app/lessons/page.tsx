import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import { getEnabledLessonIdsForUser } from '@/lib/lesson-availability'
import { isAdmin } from '@/lib/auth/permissions'
import LessonsClient from './LessonsClient'

export default async function LessonsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const [{ data: userProjects }, enabledLessonIds, admin] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, lesson_id, updated_at')
      .eq('user_id', user.id)
      .not('lesson_id', 'is', null)
      .order('updated_at', { ascending: false }),
    getEnabledLessonIdsForUser(user.id),
    isAdmin(user.id),
  ])

  // Admins previewing the catalog aren't scoped to a class, so exempt them
  // from the toggle entirely — same posture as rate limiting.
  const enabledIds = admin ? LESSONS.map((l) => l.id) : Array.from(enabledLessonIds)

  return (
    <LessonsClient
      lessons={LESSONS}
      userProjects={userProjects ?? []}
      enabledLessonIds={enabledIds}
    />
  )
}
