import { createServerSupabaseClient } from '@/lib/supabase-server'
import ExploreClient from './ExploreClient'

export default async function ExplorePage() {
  const supabase = await createServerSupabaseClient()
  const [{ data: projects }, { data: { user } }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, lesson_id, created_at, user_id, files')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.auth.getUser(),
  ])

  return <ExploreClient projects={projects ?? []} isLoggedIn={!!user} userEmail={user?.email ?? ''} />
}
