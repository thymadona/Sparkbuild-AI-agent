import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { isTeacherOfClass } from '@/lib/auth/permissions'
import { getLessonForProject } from '@/lib/lessons'
import { homeworkTasks } from '@/lib/task-guard'
import type { SubmissionStatus } from '@/types'
import TeacherClassClient from './TeacherClassClient'

export interface TeacherSubmissionRow {
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

export default async function TeacherClassDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Every query below still needs its own ownership filter — the layout
  // guard confirms the user can reach /teacher at all, not that they teach
  // this specific class.
  const allowed = await isTeacherOfClass(user!.id, params.id)
  if (!allowed) redirect('/teacher')

  const [{ data: cls }, { data: members }, { data: usersData }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('classes').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('class_members').select('user_id, role').eq('class_id', params.id),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('student_profiles').select('user_id, full_name'),
  ])

  if (!cls) redirect('/teacher')

  const studentIds = (members ?? []).filter((m) => m.role === 'student').map((m) => m.user_id)
  const emailById = Object.fromEntries((usersData?.users ?? []).map((u) => [u.id, u.email ?? u.id]))
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name]))

  const students = studentIds
    .map((id) => ({ userId: id, name: nameById[id] ?? '', email: emailById[id] ?? id.slice(0, 8) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  let homeworkRows: TeacherSubmissionRow[] = []
  if (studentIds.length > 0) {
    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id, user_id, title, lesson_id, lesson_version, submission_status, updated_at')
      .not('submission_status', 'is', null)
      .in('user_id', studentIds)
      .order('updated_at', { ascending: false })

    const submissions = projects ?? []
    const progressById = new Map<string, string[]>()
    if (submissions.length > 0) {
      const { data: progress } = await supabaseAdmin
        .from('lesson_progress')
        .select('project_id, completed_task_ids')
        .in('project_id', submissions.map((p) => p.id))
      for (const row of progress ?? []) progressById.set(row.project_id, row.completed_task_ids ?? [])
    }

    homeworkRows = submissions.map((project) => {
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
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/teacher" className="hover:text-gray-300 transition-colors">Classes</Link>
        <span>/</span>
        <span className="text-gray-300">{cls.name}</span>
      </div>

      <TeacherClassClient className={cls.name} students={students} homeworkRows={homeworkRows} />
    </div>
  )
}
