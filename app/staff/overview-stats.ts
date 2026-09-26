import { sql } from 'drizzle-orm'
import { db, rowsOf } from '@/lib/db/client'
import { STAFF_ROLES } from '@/lib/auth/permissions'
import {
  classMembers,
  classes,
  invoices,
  projects,
  roles,
  studentProfiles,
  userRoles,
  users,
} from '@/lib/db/schema'

const WEEK_MS = 7 * 86_400_000

export interface SchoolOverviewStats {
  totalClasses: number
  activeStudentCount: number
  teacherCount: number
  unpaidCount: number
  overdueCount: number
  lessonsStartedThisWeek: number
}

// One round trip for the whole dashboard: six scalar subqueries in a single
// SELECT rather than six queries in a Promise.all. Counting happens in
// Postgres, and the page pays one connection however many tiles it grows.
// Names are interpolated from lib/db/schema.ts so renames propagate.
// count() returns bigint, which the driver hands back as a string — hence ::int.
// Every count is for one org: root tables by org_id, child tables through
// their user (orgUsers) or class.
export async function getSchoolOverviewStats(orgId: string): Promise<SchoolOverviewStats> {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  const today = new Date().toISOString().split('T')[0]
  const staffRoles = sql.join(
    STAFF_ROLES.map((role) => sql`${role}`),
    sql`, `
  )
  const orgUsers = sql`(select ${users.id} from ${users} where ${users.orgId} = ${orgId})`

  const result = await db.execute(sql`
    select
      (select count(*) from ${classes}
        where ${classes.orgId} = ${orgId})::int as total_classes,

      -- user_roles holds a 'student' row for every non-staff account, so a
      -- profile owner who also holds a staff role is not a student.
      (select count(*) from ${studentProfiles}
        where ${studentProfiles.isActive} = true
          and ${studentProfiles.userId} in ${orgUsers}
          and not exists (
            select 1 from ${userRoles}
            join ${roles} on ${roles.id} = ${userRoles.roleId}
            where ${userRoles.userId} = ${studentProfiles.userId}
              and ${roles.name} in (${staffRoles})
          ))::int as active_students,

      -- Distinct, because one person can teach several classes.
      (select count(distinct ${classMembers.userId}) from ${classMembers}
        join ${classes} on ${classes.id} = ${classMembers.classId}
        where ${classMembers.role} = 'teacher'
          and ${classes.orgId} = ${orgId})::int as teachers,

      (select count(*) from ${invoices}
        where ${invoices.orgId} = ${orgId}
          and ${invoices.status} = 'unpaid')::int as unpaid,
      (select count(*) from ${invoices}
        where ${invoices.orgId} = ${orgId}
          and ${invoices.status} = 'unpaid'
          and ${invoices.dueDate} < ${today})::int as overdue,

      (select count(*) from ${projects}
        where ${projects.lessonId} is not null
          and ${projects.userId} in ${orgUsers}
          and ${projects.createdAt} >= ${weekAgo})::int as lessons_started
  `)

  const row = rowsOf<Record<string, number | null>>(result)[0] ?? {}

  return {
    totalClasses: row.total_classes ?? 0,
    activeStudentCount: row.active_students ?? 0,
    teacherCount: row.teachers ?? 0,
    unpaidCount: row.unpaid ?? 0,
    overdueCount: row.overdue ?? 0,
    lessonsStartedThisWeek: row.lessons_started ?? 0,
  }
}
