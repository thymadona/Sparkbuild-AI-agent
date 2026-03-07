import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import type { Project } from '@/types'
import EditorLayout from './EditorLayout'

interface Props {
  params: { id: string }
}

export default async function EditorPage({ params }: Props) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!project || project.user_id !== user.id) {
    notFound()
  }

  return <EditorLayout project={project as Project} />
}
