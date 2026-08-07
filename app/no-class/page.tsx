import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import NoClassClient from './NoClassClient'

export default async function NoClassPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  return <NoClassClient email={user.email ?? ''} />
}
