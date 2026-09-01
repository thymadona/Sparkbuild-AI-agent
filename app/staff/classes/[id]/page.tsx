import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  classEnabledLessons,
  classMembers,
  classSchedules,
  classes as classesTable,
  invoices,
  lessonProgress,
  projects,
  roles,
  studentProfiles,
  userRoles,
  users as usersTable,
} from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { STAFF_ROLES, hasPermission, isAdmin, isTeacherOfClass } from '@/lib/auth/permissions'
import { getLessonForProject, LESSONS, type LessonTaskType } from '@/lib/lessons'
import { homeworkTasks } from '@/lib/task-guard'
import type { ClassSchedule, SubmissionStatus } from '@/types'
import ClassDetailClient from './ClassDetailClient'
import TeacherClassClient from './TeacherClassClient'
import LessonsPanel from './LessonsPanel'
import { getSessionUser } from '@/lib/auth/session'

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

export interface StudentTaskProgress {
  id: string
  chip: string
  type: LessonTaskType
  done: boolean
}

export interface StudentLessonProgress {
  userId: string
  name: string
  email: string
  tasks: StudentTaskProgress[]
}

export interface LessonProgressEntry {
  lessonId: number
  title: string
  description: string
  enabled: boolean
  students: StudentLessonProgress[]
}

// Same URL, two genuinely different feature sets — not a UI skin
// difference. Full management (schedule, billing, add/remove teacher)
// only for classes:manage/admin; homework review + roster for the
// teacher(s) actually assigned to this specific class. isTeacherOfClass
// re-checks per class, since teaching one class grants nothing on another.
export default async function ClassDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!isUuid(params.id)) notFound()

  const canManageAll = (await isAdmin(user.id)) || (await hasPermission(user.id, 'classes:manage'))

  if (canManageAll) {
    const [
      classRows,
      members,
      schedules,
      invoiceRows,
      allUsers,
      profiles,
      roleRows,
      enabledLessons,
    ] = await Promise.all([
      db
        .select({
          id: classesTable.id,
          name: classesTable.name,
          description: classesTable.description,
        })
        .from(classesTable)
        .where(eq(classesTable.id, params.id))
        .limit(1),
      db
        .select({ user_id: classMembers.userId, role: classMembers.role })
        .from(classMembers)
        .where(eq(classMembers.classId, params.id)),
      db
        .select({
          id: classSchedules.id,
          class_id: classSchedules.classId,
          day_of_week: classSchedules.dayOfWeek,
          start_time: classSchedules.startTime,
          duration_min: classSchedules.durationMin,
          label: classSchedules.label,
        })
        .from(classSchedules)
        .where(eq(classSchedules.classId, params.id))
        .orderBy(asc(classSchedules.dayOfWeek), asc(classSchedules.startTime)),
      db.select({ user_id: invoices.userId, status: invoices.status }).from(invoices),
      // Reads public.users directly. The Supabase Auth admin listing this
      // replaced was paginated at 1000 and silently dropped everyone past it.
      db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable),
      db
        .select({ user_id: studentProfiles.userId, full_name: studentProfiles.fullName })
        .from(studentProfiles),
      db
        .select({ user_id: userRoles.userId, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId)),
      db
        .select({ lesson_id: classEnabledLessons.lessonId })
        .from(classEnabledLessons)
        .where(eq(classEnabledLessons.classId, params.id)),
    ])

    const cls = classRows[0]
    if (!cls) notFound()

    const memberIds = new Set(members.map((m) => m.user_id))
    const teacherMemberIds = new Set(members.filter((m) => m.role === 'teacher').map((m) => m.user_id))
    const studentMemberIds = new Set(members.filter((m) => m.role !== 'teacher').map((m) => m.user_id))
    const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name]))
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.email ?? '']))

    const paymentMap: Record<string, { paid: number; unpaid: number }> = {}
    for (const inv of invoiceRows) {
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

    // user_roles now holds a 'student' row for every non-staff account
    // (lib/auth/student-defaults.ts), so match on STAFF_ROLES rather than on
    // "has any role row" — the latter would empty this picker entirely. An
    // account can hold a student_profiles row *and* a staff role at once
    // (e.g. a teacher's own test account), so keep staff out of the student
    // picker even if they have a profile.
    const staffIds = new Set(
      roleRows.filter((r) => (STAFF_ROLES as readonly string[]).includes(r.name)).map((r) => r.user_id)
    )
    const availableStudents = profiles
      .filter((p) => !memberIds.has(p.user_id) && !staffIds.has(p.user_id))
      .map((p) => ({ userId: p.user_id, name: p.full_name, email: userMap[p.user_id] ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const platformTeacherIds = new Set(roleRows.filter((r) => r.name === 'teacher').map((r) => r.user_id))
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
            schedules={schedules as ClassSchedule[]}
            students={students}
            availableStudents={availableStudents}
            teachers={teachers}
            availableTeachers={availableTeachers}
          />
          <LessonsPanel classId={cls.id} enabledLessonIds={enabledLessons.map((d) => d.lesson_id)} />
        </div>
      </div>
    )
  }

  const allowed = await isTeacherOfClass(user.id, params.id)
  if (!allowed) redirect('/staff/classes')

  const [classRows, members, allUsers, profiles, enabledLessons] = await Promise.all([
    db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        description: classesTable.description,
      })
      .from(classesTable)
      .where(eq(classesTable.id, params.id))
      .limit(1),
    db
      .select({ user_id: classMembers.userId, role: classMembers.role })
      .from(classMembers)
      .where(eq(classMembers.classId, params.id)),
    // Reads public.users directly. The Supabase Auth admin listing this
    // replaced was paginated at 1000 and silently dropped everyone past it.
    db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable),
    db
      .select({ user_id: studentProfiles.userId, full_name: studentProfiles.fullName })
      .from(studentProfiles),
    db
      .select({ lesson_id: classEnabledLessons.lessonId })
      .from(classEnabledLessons)
      .where(eq(classEnabledLessons.classId, params.id)),
  ])

  const cls = classRows[0]
  if (!cls) redirect('/staff/classes')

  const studentIds = members.filter((m) => m.role === 'student').map((m) => m.user_id)
  const emailById = Object.fromEntries(allUsers.map((u) => [u.id, u.email ?? u.id]))
  const nameById = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name]))

  const students = studentIds
    .map((id) => ({ userId: id, name: nameById[id] ?? '', email: emailById[id] ?? id.slice(0, 8) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  let homeworkRows: TeacherSubmissionRow[] = []
  if (studentIds.length > 0) {
    const submissions = await db
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
      .where(and(isNotNull(projects.submissionStatus), inArray(projects.userId, studentIds)))
      .orderBy(desc(projects.updatedAt))

    const progressById = new Map<string, string[]>()
    if (submissions.length > 0) {
      const progress = await db
        .select({
          project_id: lessonProgress.projectId,
          completed_task_ids: lessonProgress.completedTaskIds,
        })
        .from(lessonProgress)
        .where(inArray(lessonProgress.projectId, submissions.map((p) => p.id)))

      for (const row of progress) progressById.set(row.project_id, row.completed_task_ids)
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

  const enabledLessonIds = (enabledLessons ?? []).map((d) => d.lesson_id)
  const blankTasks = (lesson: (typeof LESSONS)[number]) =>
    lesson.tasks.map((t) => ({ id: t.id, chip: t.chip, type: t.type, done: false }))

  let lessonsProgress: LessonProgressEntry[] = LESSONS.map((lesson) => ({
    lessonId: lesson.id,
    title: lesson.title,
    description: lesson.description,
    enabled: enabledLessonIds.includes(lesson.id),
    students: students.map((s) => ({ userId: s.userId, name: s.name, email: s.email, tasks: blankTasks(lesson) })),
  }))

  if (studentIds.length > 0) {
    // Every project a student has started, one row per (student, lesson) at
    // most since we keep only the most recently updated per pair below —
    // unlike homeworkRows above, this isn't limited to submitted homework.
    const projectRows = await db
      .select({
        id: projects.id,
        user_id: projects.userId,
        lesson_id: projects.lessonId,
        lesson_version: projects.lessonVersion,
        updated_at: projects.updatedAt,
      })
      .from(projects)
      .where(and(inArray(projects.userId, studentIds), isNotNull(projects.lessonId)))
      .orderBy(desc(projects.updatedAt))

    const allProgressById = new Map<string, string[]>()
    if (projectRows.length > 0) {
      const progressRows = await db
        .select({
          project_id: lessonProgress.projectId,
          completed_task_ids: lessonProgress.completedTaskIds,
        })
        .from(lessonProgress)
        .where(inArray(lessonProgress.projectId, projectRows.map((p) => p.id)))

      for (const row of progressRows) allProgressById.set(row.project_id, row.completed_task_ids)
    }

    const latestByStudentLesson = new Map<string, (typeof projectRows)[number]>()
    for (const p of projectRows) {
      const key = `${p.user_id}:${p.lesson_id}`
      if (!latestByStudentLesson.has(key)) latestByStudentLesson.set(key, p)
    }

    lessonsProgress = LESSONS.map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      description: lesson.description,
      enabled: enabledLessonIds.includes(lesson.id),
      students: students.map((s) => {
        const project = latestByStudentLesson.get(`${s.userId}:${lesson.id}`)
        if (!project) return { userId: s.userId, name: s.name, email: s.email, tasks: blankTasks(lesson) }
        // The query filters on lesson_id IS NOT NULL, but the column is
        // nullable so the select type still admits null. Fall back to the
        // lesson being rendered rather than casting.
        const resolved =
          project.lesson_id == null
            ? lesson
            : getLessonForProject(project.lesson_id, project.lesson_version) ?? lesson
        const doneIds = new Set(allProgressById.get(project.id) ?? [])
        return {
          userId: s.userId,
          name: s.name,
          email: s.email,
          tasks: resolved.tasks.map((t) => ({ id: t.id, chip: t.chip, type: t.type, done: doneIds.has(t.id) })),
        }
      }),
    }))
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/staff/classes" className="hover:text-gray-300 transition-colors">Classes</Link>
        <span>/</span>
        <span className="text-gray-300">{cls.name}</span>
      </div>

      <TeacherClassClient
        classId={cls.id}
        className={cls.name}
        homeworkRows={homeworkRows}
        lessonsProgress={lessonsProgress}
      />
    </div>
  )
}
