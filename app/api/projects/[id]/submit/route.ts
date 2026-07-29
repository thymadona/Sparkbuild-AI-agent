import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { getLessonForProject } from '@/lib/lessons'
import { homeworkComplete, homeworkTasks } from '@/lib/task-guard'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Hands homework in for teacher review.
 *
 * Server-authoritative, like the build-mode gate: the client cannot mark
 * homework submitted unless every homework task is recorded complete.
 */
export async function POST(_req: Request, props: Props) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, lesson_id, lesson_version, submission_status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!project || project.lesson_id == null) {
    return NextResponse.json({ error: 'Lesson project not found' }, { status: 404 })
  }

  const lesson = getLessonForProject(project.lesson_id, project.lesson_version)
  if (homeworkTasks(lesson).length === 0) {
    return NextResponse.json({ error: 'This lesson has no homework' }, { status: 400 })
  }

  if (project.submission_status === 'submitted' || project.submission_status === 'approved') {
    return NextResponse.json({ submissionStatus: project.submission_status })
  }

  const { data: progress } = await supabaseAdmin
    .from('lesson_progress')
    .select('completed_task_ids')
    .eq('project_id', params.id)
    .maybeSingle()

  const completed = progress?.completed_task_ids ?? []
  if (!homeworkComplete(lesson, completed)) {
    return NextResponse.json({ error: 'Finish your homework tasks first' }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('projects')
    .update({ submission_status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submissionStatus: 'submitted' })
}
