import { notFound, redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import LessonDetailClient from './LessonDetailClient'
import { getSessionUser } from '@/lib/auth/session'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LessonPage(props: Props) {
  const params = await props.params;
  const user = await getSessionUser()

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
