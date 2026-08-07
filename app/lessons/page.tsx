import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import { getDisabledLessonIdsForUser } from '@/lib/lesson-availability'
import LessonsClient from './LessonsClient'

export default async function LessonsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const [{ data: userProjects }, disabledLessonIds] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, lesson_id, updated_at')
      .eq('user_id', user.id)
      .not('lesson_id', 'is', null)
      .order('updated_at', { ascending: false }),
    getDisabledLessonIdsForUser(user.id),
  ])

  return (
    <LessonsClient
      lessons={LESSONS}
      userProjects={userProjects ?? []}
      disabledLessonIds={Array.from(disabledLessonIds)}
    />
  )
}
