import { redirect } from 'next/navigation'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  classMembers,
  classSchedules,
  classes as classesTable,
  invoices,
  projects,
  roles,
  studentProfiles,
  userRoles,
  users as usersTable,
} from '@/lib/db/schema'
import { hasPermission, isAdmin, getTeacherClassIds } from '@/lib/auth/permissions'
import ClassesClient from './ClassesClient'
import TeacherClassesClient from './TeacherClassesClient'
import { getSessionUser } from '@/lib/auth/session'

// Two structurally different views live at one URL: someone who can
// manage all classes gets the full admin roster/schedule/billing table;
// a teacher with no broader permission gets the scoped "classes I teach"
// list they'd get at the old /teacher route. Neither branch is exposed to
// a user who qualifies for the other, so each still needs its own check —
// this isn't just a nav-visibility split.
export default async function ClassesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const canManageAll = (await isAdmin(user.id)) || (await hasPermission(user.id, 'classes:manage'))

  if (canManageAll) {
    const [classes, members, schedules, invoiceRows, allUsers, profiles, roleRows] =
      await Promise.all([
        db
          .select({
            id: classesTable.id,
            name: classesTable.name,
            description: classesTable.description,
            created_at: classesTable.createdAt,
          })
          .from(classesTable)
          .orderBy(desc(classesTable.createdAt)),
        db
          .select({
            class_id: classMembers.classId,
            user_id: classMembers.userId,
            role: classMembers.role,
          })
          .from(classMembers),
        db
          .select({
            class_id: classSchedules.classId,
            day_of_week: classSchedules.dayOfWeek,
            start_time: classSchedules.startTime,
            duration_min: classSchedules.durationMin,
          })
          .from(classSchedules)
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
      ])

    const membersByClass: Record<string, string[]> = {}
    for (const m of members) {
      if (m.role !== 'student') continue
      if (!membersByClass[m.class_id]) membersByClass[m.class_id] = []
      membersByClass[m.class_id].push(m.user_id)
    }

    const schedulesByClass: Record<string, { day_of_week: number; start_time: string; duration_min: number }[]> = {}
    for (const s of schedules) {
      if (!schedulesByClass[s.class_id]) schedulesByClass[s.class_id] = []
      schedulesByClass[s.class_id].push({ day_of_week: s.day_of_week, start_time: s.start_time, duration_min: s.duration_min })
    }

    const paidUsers = new Set(invoiceRows.filter((i) => i.status === 'paid').map((i) => i.user_id))
    const unpaidUsers = new Set(invoiceRows.filter((i) => i.status === 'unpaid').map((i) => i.user_id))

    const rows = classes.map((cls) => {
      const userIds = membersByClass[cls.id] ?? []
      return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        createdAt: cls.created_at,
        studentCount: userIds.length,
        schedules: schedulesByClass[cls.id] ?? [],
        paidCount: userIds.filter((id) => paidUsers.has(id)).length,
        unpaidCount: userIds.filter((id) => unpaidUsers.has(id)).length,
      }
    })

    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.email ?? '']))
    const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name]))
    const platformTeacherIds = new Set(roleRows.filter((r) => r.name === 'teacher').map((r) => r.user_id))
    // Only 'admin' and 'teacher' roles exist in user_roles — a student never
    // has a row there. An account can hold a student_profiles row *and* a
    // staff role at once (e.g. a teacher's own test account), so keep staff
    // out of the student picker even if they have a profile.
    const staffIds = new Set(roleRows.map((r) => r.user_id))
    const allTeachers = Array.from(platformTeacherIds)
      .map((userId) => ({ userId, name: profileMap[userId] ?? '', email: userMap[userId] ?? userId.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const allStudents = profiles
      .filter((p) => !staffIds.has(p.user_id))
      .map((p) => ({ userId: p.user_id, name: p.full_name, email: userMap[p.user_id] ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-100">Classes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Filter by day, view schedules, and open class details</p>
        </div>
        <ClassesClient classes={rows} allTeachers={allTeachers} allStudents={allStudents} />
      </div>
    )
  }

  const classIds = await getTeacherClassIds(user.id)
  if (classIds.length === 0) redirect('/staff')

  const [classes, members, submitted] = await Promise.all([
    db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        description: classesTable.description,
      })
      .from(classesTable)
      .where(inArray(classesTable.id, classIds))
      .orderBy(asc(classesTable.name)),
    db
      .select({
        class_id: classMembers.classId,
        user_id: classMembers.userId,
        role: classMembers.role,
      })
      .from(classMembers)
      .where(inArray(classMembers.classId, classIds)),
    db
      .select({ user_id: projects.userId })
      .from(projects)
      .where(eq(projects.submissionStatus, 'submitted')),
  ])

  const studentIdsByClass: Record<string, string[]> = {}
  for (const m of members) {
    if (m.role !== 'student') continue
    if (!studentIdsByClass[m.class_id]) studentIdsByClass[m.class_id] = []
    studentIdsByClass[m.class_id].push(m.user_id)
  }

  const pendingReviewUserIds = new Set(submitted.map((p) => p.user_id))

  const rows = classes.map((cls) => {
    const studentIds = studentIdsByClass[cls.id] ?? []
    return {
      id: cls.id,
      name: cls.name,
      description: cls.description,
      studentCount: studentIds.length,
      pendingReviewCount: studentIds.filter((id) => pendingReviewUserIds.has(id)).length,
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Your classes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rosters and homework review, scoped to classes you teach.</p>
      </div>
      <TeacherClassesClient classes={rows} />
    </div>
  )
}
