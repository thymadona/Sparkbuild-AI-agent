import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { getLessonForProject } from '@/lib/lessons'
import { invalidate } from '@/lib/cache'

interface Props {
  params: Promise<{ id: string }>
}

async function getLessonProject(projectId: string, userId: string) {
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, lesson_id, lesson_version')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project || project.lesson_id == null) return null
  const lesson = getLessonForProject(project.lesson_id, project.lesson_version)
  return lesson ? { project, lesson } : null
}

export async function GET(_req: Request, props: Props) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lessonProject = await getLessonProject(params.id, user.id)
  if (!lessonProject) return NextResponse.json({ error: 'Lesson project not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('lesson_progress')
    .select('completed_task_ids')
    .eq('project_id', params.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ completedTaskIds: data?.completed_task_ids ?? [] })
}

export async function PUT(req: Request, props: Props) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lessonProject = await getLessonProject(params.id, user.id)
  if (!lessonProject) return NextResponse.json({ error: 'Lesson project not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const completedTaskIds = body.completedTaskIds
  if (!Array.isArray(completedTaskIds) || !completedTaskIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'completedTaskIds must be an array of strings' }, { status: 400 })
  }

  const validTaskIds = new Set(lessonProject.lesson.tasks.map((task) => task.id))
  const uniqueTaskIds = Array.from(new Set(completedTaskIds))
  if (!uniqueTaskIds.every((id) => validTaskIds.has(id))) {
    return NextResponse.json({ error: 'completedTaskIds contains an invalid task' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_progress')
    .upsert({
      project_id: params.id,
      completed_task_ids: uniqueTaskIds,
      updated_at: new Date().toISOString(),
    })
    .select('completed_task_ids')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await invalidate(`lesson-progress:${params.id}`)

  return NextResponse.json({ completedTaskIds: data.completed_task_ids })
}
