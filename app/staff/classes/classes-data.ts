import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  classMembers,
  classSchedules,
  classes as classesTable,
  invoices,
  roles,
  studentProfiles,
  userRoles,
  users as usersTable,
} from '@/lib/db/schema'
import { STAFF_ROLES } from '@/lib/auth/permissions'
import { classesInOrg, usersInOrg } from '@/lib/orgs'

// The admin view of /staff/classes, for one org: classes, users and invoices
// by org_id; members and schedules through their class (and members through
// their user too, since class_members has no org link); profiles through
// their user; staff grants by user_roles.org_id.
export async function loadClasses(orgId: string) {
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
        .where(eq(classesTable.orgId, orgId))
        .orderBy(desc(classesTable.createdAt)),
      db
        .select({
          class_id: classMembers.classId,
          user_id: classMembers.userId,
          role: classMembers.role,
        })
        .from(classMembers)
        .where(
          and(
            inArray(classMembers.classId, classesInOrg(orgId)),
            inArray(classMembers.userId, usersInOrg(orgId))
          )
        ),
      db
        .select({
          class_id: classSchedules.classId,
          day_of_week: classSchedules.dayOfWeek,
          start_time: classSchedules.startTime,
          duration_min: classSchedules.durationMin,
        })
        .from(classSchedules)
        .where(inArray(classSchedules.classId, classesInOrg(orgId)))
        .orderBy(asc(classSchedules.dayOfWeek), asc(classSchedules.startTime)),
      db
        .select({ user_id: invoices.userId, status: invoices.status })
        .from(invoices)
        .where(eq(invoices.orgId, orgId)),
      // Reads public.users directly. The Supabase Auth admin listing this
      // replaced was paginated at 1000 and silently dropped everyone past it.
      db
        .select({ id: usersTable.id, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.orgId, orgId)),
      db
        .select({ user_id: studentProfiles.userId, full_name: studentProfiles.fullName })
        .from(studentProfiles)
        .where(inArray(studentProfiles.userId, usersInOrg(orgId))),
      db
        .select({ user_id: userRoles.userId, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(eq(userRoles.orgId, orgId)),
    ])

  const membersByClass: Record<string, string[]> = {}
  for (const m of members) {
    if (m.role !== 'student') continue
    if (!membersByClass[m.class_id]) membersByClass[m.class_id] = []
    membersByClass[m.class_id].push(m.user_id)
  }

  const schedulesByClass: Record<
    string,
    { day_of_week: number; start_time: string; duration_min: number }[]
  > = {}
  for (const s of schedules) {
    if (!schedulesByClass[s.class_id]) schedulesByClass[s.class_id] = []
    schedulesByClass[s.class_id].push({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      duration_min: s.duration_min,
    })
  }

  const paidUsers = new Set(invoiceRows.filter((i) => i.status === 'paid').map((i) => i.user_id))
  const unpaidUsers = new Set(
    invoiceRows.filter((i) => i.status === 'unpaid').map((i) => i.user_id)
  )

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
  const platformTeacherIds = new Set(
    roleRows.filter((r) => r.name === 'teacher').map((r) => r.user_id)
  )
  // user_roles now holds a 'student' row for every non-staff account
  // (lib/auth/student-defaults.ts), so match on STAFF_ROLES rather than on
  // "has any role row" — the latter would empty this picker entirely. An
  // account can hold a student_profiles row *and* a staff role at once
  // (e.g. a teacher's own test account), so keep staff out of the student
  // picker even if they have a profile.
  const staffIds = new Set(
    roleRows
      .filter((r) => (STAFF_ROLES as readonly string[]).includes(r.name))
      .map((r) => r.user_id)
  )
  const allTeachers = Array.from(platformTeacherIds)
    .map((userId) => ({
      userId,
      name: profileMap[userId] ?? '',
      email: userMap[userId] ?? userId.slice(0, 8),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const allStudents = profiles
    .filter((p) => !staffIds.has(p.user_id))
    .map((p) => ({ userId: p.user_id, name: p.full_name, email: userMap[p.user_id] ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { rows, allTeachers, allStudents }
}
