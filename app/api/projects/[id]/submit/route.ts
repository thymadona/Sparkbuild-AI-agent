import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { getLessonForProject } from '@/lib/lessons'
import { homeworkComplete, homeworkTasks } from '@/lib/task-guard'
import { getSessionUser } from '@/lib/auth/session'

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
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Lesson project not found' }, { status: 404 })
  }

  const [project] = await db
    .select({
      id: projects.id,
      lesson_id: projects.lessonId,
      lesson_version: projects.lessonVersion,
      submission_status: projects.submissionStatus,
    })
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, user.id)))
    .limit(1)

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

  const [progress] = await db
    .select({ completed_task_ids: lessonProgress.completedTaskIds })
    .from(lessonProgress)
    .where(eq(lessonProgress.projectId, params.id))
    .limit(1)

  const completed = progress?.completed_task_ids ?? []
  if (!homeworkComplete(lesson, completed)) {
    return NextResponse.json({ error: 'Finish your homework tasks first' }, { status: 409 })
  }

  // Drizzle throws where the PostgREST client returned `{ error }`, so the
  // 500 path is a catch rather than a branch.
  try {
    await db
      .update(projects)
      .set({ submissionStatus: 'submitted', updatedAt: new Date().toISOString() })
      .where(and(eq(projects.id, params.id), eq(projects.userId, user.id)))
  } catch (err) {
    console.error('submit: failed to mark project submitted:', err)
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }

  return NextResponse.json({ submissionStatus: 'submitted' })
}
