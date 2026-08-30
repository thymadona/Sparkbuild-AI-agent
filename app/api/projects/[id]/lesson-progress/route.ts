import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { getLessonForProject } from '@/lib/lessons'
import { invalidate } from '@/lib/cache'
import { getSessionUser } from '@/lib/auth/session'

interface Props {
  params: Promise<{ id: string }>
}

async function getLessonProject(projectId: string, userId: string) {
  if (!isUuid(projectId)) return null

  const [project] = await db
    .select({
      id: projects.id,
      lesson_id: projects.lessonId,
      lesson_version: projects.lessonVersion,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (!project || project.lesson_id == null) return null
  const lesson = getLessonForProject(project.lesson_id, project.lesson_version)
  return lesson ? { project, lesson } : null
}

export async function GET(_req: Request, props: Props) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lessonProject = await getLessonProject(params.id, user.id)
  if (!lessonProject) return NextResponse.json({ error: 'Lesson project not found' }, { status: 404 })

  try {
    const [row] = await db
      .select({ completed_task_ids: lessonProgress.completedTaskIds })
      .from(lessonProgress)
      .where(eq(lessonProgress.projectId, params.id))
      .limit(1)

    return NextResponse.json({ completedTaskIds: row?.completed_task_ids ?? [] })
  } catch (err) {
    console.error('lesson-progress GET failed:', err)
    return NextResponse.json({ error: 'Failed to read progress' }, { status: 500 })
  }
}

export async function PUT(req: Request, props: Props) {
  const params = await props.params;
  const user = await getSessionUser()
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

  let saved: string[]
  try {
    // The upsert target has to be named explicitly here; PostgREST inferred it
    // from the primary key. lesson_progress is keyed by project_id alone.
    const [row] = await db
      .insert(lessonProgress)
      .values({
        projectId: params.id,
        completedTaskIds: uniqueTaskIds,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: lessonProgress.projectId,
        set: { completedTaskIds: uniqueTaskIds, updatedAt: new Date().toISOString() },
      })
      .returning({ completed_task_ids: lessonProgress.completedTaskIds })

    saved = row.completed_task_ids
  } catch (err) {
    console.error('lesson-progress PUT failed:', err)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }

  await invalidate(`lesson-progress:${params.id}`)

  return NextResponse.json({ completedTaskIds: saved })
}
