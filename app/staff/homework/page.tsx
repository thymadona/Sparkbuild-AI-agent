import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { db } from '@/lib/db/client'
import { users as usersTable } from '@/lib/db/schema'
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

  const [{ data: projects }, { data: usersData }, { data: profiles }] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, user_id, title, lesson_id, lesson_version, submission_status, updated_at')
      .not('submission_status', 'is', null)
      .order('updated_at', { ascending: false }),
// Was supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }) — a cap that
    // silently dropped every user past the thousandth. Kept in the PostgREST
    // result shape so the mapping below is untouched; the surrounding queries
    // move to Drizzle with the rest of this page.
    db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .then((rows) => ({ data: { users: rows } })),
    supabaseAdmin.from('student_profiles').select('user_id, full_name'),
  ])

  const submissions = projects ?? []
  const progressById = new Map<string, string[]>()
  if (submissions.length > 0) {
    const { data: progress } = await supabaseAdmin
      .from('lesson_progress')
      .select('project_id, completed_task_ids')
      .in(
        'project_id',
        submissions.map((project) => project.id),
      )
    for (const row of progress ?? []) progressById.set(row.project_id, row.completed_task_ids ?? [])
  }

  const emailById = Object.fromEntries((usersData?.users ?? []).map((u) => [u.id, u.email ?? u.id]))
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name]))

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
