import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import LessonDetailClient from './LessonDetailClient'

interface Props {
  params: { id: string }
}

export default async function LessonPage({ params }: Props) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const lesson = LESSONS.find((l) => l.id === Number(params.id))
  if (!lesson) notFound()

  const { data: existingProjects } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('user_id', user.id)
    .eq('lesson_id', lesson.id)
    .order('updated_at', { ascending: false })
    .limit(1)

  return <LessonDetailClient lesson={lesson} existingProjectId={existingProjects?.[0]?.id ?? null} />
}
