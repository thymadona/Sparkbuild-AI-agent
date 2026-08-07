import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission, isAdmin, isTeacherOfClass } from '@/lib/auth/permissions'
import { getLessonForProject } from '@/lib/lessons'
import { homeworkTasks } from '@/lib/task-guard'
import type { ClassSchedule, SubmissionStatus } from '@/types'
import ClassDetailClient from './ClassDetailClient'
import TeacherClassClient from './TeacherClassClient'
import LessonsPanel from './LessonsPanel'

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

// Same URL, two genuinely different feature sets — not a UI skin
// difference. Full management (schedule, billing, add/remove teacher)
// only for classes:manage/admin; homework review + roster for the
// teacher(s) actually assigned to this specific class. isTeacherOfClass
// re-checks per class, since teaching one class grants nothing on another.
export default async function ClassDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const canManageAll = (await isAdmin(user.id)) || (await hasPermission(user.id, 'classes:manage'))

  if (canManageAll) {
    const [
      { data: cls },
      { data: members },
      { data: schedules },
      { data: invoices },
      { data: usersData },
      { data: profiles },
      { data: teacherRoleRows },
      { data: enabledLessons },
    ] = await Promise.all([
      supabaseAdmin.from('classes').select('*').eq('id', params.id).single(),
      supabaseAdmin.from('class_members').select('user_id, role').eq('class_id', params.id),
      supabaseAdmin.from('class_schedules').select('*').eq('class_id', params.id).order('day_of_week').order('start_time'),
      supabaseAdmin.from('invoices').select('user_id, status'),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from('student_profiles').select('user_id, full_name'),
      supabaseAdmin.from('user_roles').select('user_id, roles(name)'),
      supabaseAdmin.from('class_enabled_lessons').select('lesson_id').eq('class_id', params.id),
    ])

    if (!cls) notFound()

    const memberIds = new Set((members ?? []).map((m) => m.user_id))
    const teacherMemberIds = new Set((members ?? []).filter((m) => m.role === 'teacher').map((m) => m.user_id))
    const studentMemberIds = new Set((members ?? []).filter((m) => m.role !== 'teacher').map((m) => m.user_id))
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name]))
    const userMap = Object.fromEntries((usersData?.users ?? []).map((u) => [u.id, u.email ?? '']))

    const paymentMap: Record<string, { paid: number; unpaid: number }> = {}
    for (const inv of invoices ?? []) {
      if (!memberIds.has(inv.user_id)) continue
      if (!paymentMap[inv.user_id]) paymentMap[inv.user_id] = { paid: 0, unpaid: 0 }
      if (inv.status === 'paid') paymentMap[inv.user_id].paid++
      else if (inv.status === 'unpaid') paymentMap[inv.user_id].unpaid++
    }

    const students = Array.from(studentMemberIds).map((userId) => ({
      userId,
      name: profileMap[userId] ?? '',
      email: userMap[userId] ?? userId.slice(0, 8),
      paidCount: paymentMap[userId]?.paid ?? 0,
      unpaidCount: paymentMap[userId]?.unpaid ?? 0,
    })).sort((a, b) => a.name.localeCompare(b.name))

    const teachers = Array.from(teacherMemberIds).map((userId) => ({
      userId,
      name: profileMap[userId] ?? '',
      email: userMap[userId] ?? userId.slice(0, 8),
    })).sort((a, b) => a.name.localeCompare(b.name))

    const availableStudents = (profiles ?? [])
      .filter((p) => !memberIds.has(p.user_id))
      .map((p) => ({ userId: p.user_id, name: p.full_name, email: userMap[p.user_id] ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const platformTeacherIds = new Set(
      ((teacherRoleRows ?? []) as unknown as { user_id: string; roles: { name: string } | null }[])
        .filter((r) => r.roles?.name === 'teacher')
        .map((r) => r.user_id)
    )
    const availableTeachers = Array.from(platformTeacherIds)
      .filter((userId) => !teacherMemberIds.has(userId))
      .map((userId) => ({ userId, name: profileMap[userId] ?? '', email: userMap[userId] ?? userId.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return (
      <div>
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/staff/classes" className="hover:text-gray-300 transition-colors">Classes</Link>
          <span>/</span>
          <span className="text-gray-300">{cls.name}</span>
        </div>

        <div className="space-y-6">
          <ClassDetailClient
            classId={cls.id}
            className={cls.name}
            description={cls.description}
            schedules={(schedules ?? []) as ClassSchedule[]}
            students={students}
            availableStudents={availableStudents}
            teachers={teachers}
            availableTeachers={availableTeachers}
          />
          <LessonsPanel classId={cls.id} enabledLessonIds={(enabledLessons ?? []).map((d) => d.lesson_id)} />
        </div>
      </div>
    )
  }

  const allowed = await isTeacherOfClass(user.id, params.id)
  if (!allowed) redirect('/staff/classes')

  const [{ data: cls }, { data: members }, { data: usersData }, { data: profiles }, { data: enabledLessons }] = await Promise.all([
    supabaseAdmin.from('classes').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('class_members').select('user_id, role').eq('class_id', params.id),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('student_profiles').select('user_id, full_name'),
    supabaseAdmin.from('class_enabled_lessons').select('lesson_id').eq('class_id', params.id),
  ])

  if (!cls) redirect('/staff/classes')

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
        <Link href="/staff/classes" className="hover:text-gray-300 transition-colors">Classes</Link>
        <span>/</span>
        <span className="text-gray-300">{cls.name}</span>
      </div>

      <div className="space-y-6">
        <TeacherClassClient className={cls.name} students={students} homeworkRows={homeworkRows} />
        <LessonsPanel classId={cls.id} enabledLessonIds={(enabledLessons ?? []).map((d) => d.lesson_id)} />
      </div>
    </div>
  )
}
