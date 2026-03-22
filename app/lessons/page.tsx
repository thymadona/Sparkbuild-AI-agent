import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import LessonsClient from './LessonsClient'

export default async function LessonsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: userProjects } = await supabaseAdmin
    .from('projects')
    .select('id, lesson_id')
    .eq('user_id', user.id)
    .not('lesson_id', 'is', null)

  return <LessonsClient lessons={LESSONS} userProjects={userProjects ?? []} />
}
