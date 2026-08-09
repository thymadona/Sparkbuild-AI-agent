import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { getEnabledLessonIdsForUser } from '@/lib/lesson-availability'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { LESSONS } from '@/lib/lessons'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const [{ data: projects }, enabledLessonIds, admin, teacher] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, title, lesson_id, updated_at, is_public')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    getEnabledLessonIdsForUser(user.id),
    isAdmin(user.id),
    isTeacher(user.id),
  ])

  // Same bypass as the lessons catalog: a teacher/admin previewing isn't
  // gated by the per-class toggle meant to control student access.
  const enabledIds = admin || teacher ? LESSONS.map((l) => l.id) : Array.from(enabledLessonIds)

  return (
    <DashboardClient
      initialProjects={projects ?? []}
      userEmail={user.email ?? ''}
      enabledLessonIds={enabledIds}
    />
  )
}
