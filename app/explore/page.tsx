import { createServerSupabaseClient } from '@/lib/supabase-server'
import ExploreClient from './ExploreClient'

export default async function ExplorePage() {
  const supabase = await createServerSupabaseClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, lesson_id, created_at, user_id, files')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(60)

  return <ExploreClient projects={projects ?? []} />
}
