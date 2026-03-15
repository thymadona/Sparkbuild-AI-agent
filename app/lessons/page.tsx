import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import LessonsClient from './LessonsClient'

export default async function LessonsPage() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <LessonsClient lessons={LESSONS} />
}
