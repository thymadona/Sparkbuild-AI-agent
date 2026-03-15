import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { LESSONS } from '@/lib/lessons'
import LessonDetailClient from './LessonDetailClient'

interface Props {
  params: { id: string }
}

export default async function LessonPage({ params }: Props) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const lesson = LESSONS.find((l) => l.id === Number(params.id))
  if (!lesson) notFound()

  return <LessonDetailClient lesson={lesson} />
}
