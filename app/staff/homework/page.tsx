import { redirect } from 'next/navigation'
import { desc, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, projects, studentProfiles, users as usersTable } from '@/lib/db/schema'
import { isAdmin } from '@/lib/auth/permissions'
import { getLessonForProject } from '@/lib/lessons'
import { homeworkTasks } from '@/lib/task-guard'
import type { SubmissionStatus } from '@/types'
import HomeworkClient from './HomeworkClient'
import { getSessionUser } from '@/lib/auth/session'

export interface SubmissionRow {
  projectId: string
  title: string
  studentName: string
  studentEmail: string
  lessonTitle: string
  status: SubmissionStatus
  homeworkDone: number
  homeworkTotal: number
  updatedAt: string
}

export default async function HomeworkPage() {
  const user = await getSessionUser()
  // Cross-class queue — unlike /staff/classes/[id]'s homework table, this
  // has no per-teacher scoping, so it stays admin-only. Teachers review
  // via their own class page.
  if (!user || !(await isAdmin(user.id))) redirect('/staff')

  const [submissions, allUsers, profiles] = await Promise.all([
    db
      .select({
        id: projects.id,
        user_id: projects.userId,
        title: projects.title,
        lesson_id: projects.lessonId,
        lesson_version: projects.lessonVersion,
        submission_status: projects.submissionStatus,
        updated_at: projects.updatedAt,
      })
      .from(projects)
      .where(isNotNull(projects.submissionStatus))
      .orderBy(desc(projects.updatedAt)),
    // Reads public.users directly. The Supabase Auth admin listing this
    // replaced was paginated at 1000 and silently dropped everyone past it.
    db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable),
    db
      .select({ user_id: studentProfiles.userId, full_name: studentProfiles.fullName })
      .from(studentProfiles),
  ])

  const progressById = new Map<string, string[]>()
  if (submissions.length > 0) {
    const progress = await db
      .select({
        project_id: lessonProgress.projectId,
        completed_task_ids: lessonProgress.completedTaskIds,
      })
      .from(lessonProgress)
      .where(inArray(lessonProgress.projectId, submissions.map((project) => project.id)))

    for (const row of progress) progressById.set(row.project_id, row.completed_task_ids)
  }

  const emailById = Object.fromEntries(allUsers.map((u) => [u.id, u.email ?? u.id]))
  const nameById = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name]))

  const rows: SubmissionRow[] = submissions.map((project) => {
    const lesson = getLessonForProject(project.lesson_id ?? -1, project.lesson_version)
    const homework = homeworkTasks(lesson)
    const done = new Set(progressById.get(project.id) ?? [])
    return {
      projectId: project.id,
      title: project.title,
      studentName: nameById[project.user_id] || '',
      studentEmail: emailById[project.user_id] ?? project.user_id,
      lessonTitle: lesson?.title ?? 'Unknown lesson',
      status: project.submission_status as SubmissionStatus,
      homeworkDone: homework.filter((task) => done.has(task.id)).length,
      homeworkTotal: homework.length,
      updatedAt: project.updated_at,
    }
  })

  return <HomeworkClient rows={rows} />
}
