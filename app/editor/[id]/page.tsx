import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import type { Project, Message } from '@/types'
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

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: true })
    .limit(100)

  return (
    <EditorLayout
      project={project as Project}
      initialMessages={(messages ?? []) as Message[]}
    />
  )
}
