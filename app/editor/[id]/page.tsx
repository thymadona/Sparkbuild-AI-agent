import { redirect, notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { Project, Message } from '@/types'
import { getLessonForProject } from '@/lib/lessons'
import type { ClassSlot } from '@/lib/schedule'
import EditorLayout from './EditorLayout'
import { getSessionUser } from '@/lib/auth/session'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage(props: Props) {
  const params = await props.params;
  const user = await getSessionUser()

  if (!user) {
    redirect('/')
  }

  // These don't depend on each other — messages are fetched for `params.id`
  // regardless of ownership, and simply discarded if the check below fails.
  const [{ data: project }, { data: messages }] = await Promise.all([
    supabaseAdmin.from('projects').select('*').eq('id', params.id).single(),
    supabaseAdmin
      .from('messages')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at', { ascending: true })
      .limit(100),
  ])

  if (!project || project.user_id !== user.id) {
    notFound()
  }

  const lesson = project.lesson_id != null
    ? getLessonForProject(project.lesson_id, project.lesson_version)
    : null

  // Homework is due before this student's next class. Slots are passed raw so
  // the browser can resolve them in the student's own timezone.
  let classSlots: ClassSlot[] = []
  let lessonProgress: { completed_task_ids: string[] } | null = null

  if (lesson) {
    const [{ data: progress }, { data: memberships }] = await Promise.all([
      supabaseAdmin
        .from('lesson_progress')
        .select('completed_task_ids')
        .eq('project_id', params.id)
        .maybeSingle(),
      supabaseAdmin
        .from('class_members')
        .select('class_id')
        .eq('user_id', user.id),
    ])
    lessonProgress = progress

    const classIds = (memberships ?? []).map((row) => row.class_id)
    if (classIds.length > 0) {
      const { data: schedules } = await supabaseAdmin
        .from('class_schedules')
        .select('day_of_week, start_time')
        .in('class_id', classIds)
      classSlots = schedules ?? []
    }
  }

  return (
    <EditorLayout
      classSlots={classSlots}
      project={project as Project}
      initialMessages={(messages ?? []) as Message[]}
      lesson={lesson}
      initialCompletedTaskIds={lessonProgress?.completed_task_ids ?? []}
      userEmail={user.email ?? ''}
    />
  )
}
