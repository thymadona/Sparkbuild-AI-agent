import { sql } from 'drizzle-orm'
import { db, rowsOf } from '@/lib/db/client'
import { STAFF_ROLES } from '@/lib/auth/permissions'
import {
  classMembers,
  classes,
  invoices,
  projects,
  prompts,
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
  promptsToday: number
  totalPrompts: number
  // 14 entries, oldest first, zero-filled — real per-day counts, not a
  // fabricated trend. A second round trip rather than folded into the
  // scalar-subquery SELECT below: this is a row-set, not one more number.
  promptsByDay: number[]
}

// One round trip for the whole dashboard: ten scalar subqueries in a single
// SELECT rather than ten queries in a Promise.all. Counting happens in
// Postgres, and the page pays one connection however many tiles it grows.
// Names are interpolated from lib/db/schema.ts so renames propagate.
// count() returns bigint, which the driver hands back as a string — hence ::int.
// Every count is for one org: root tables by org_id, child tables through
// their user (orgUsers) or class.
export async function getSchoolOverviewStats(orgId: string): Promise<SchoolOverviewStats> {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const today = new Date().toISOString().split('T')[0]
  const staffRoles = sql.join(
    STAFF_ROLES.map((role) => sql`${role}`),
    sql`, `
  )
  const orgUsers = sql`(select ${users.id} from ${users} where ${users.orgId} = ${orgId})`

  const [result, trendResult] = await Promise.all([
    db.execute(sql`
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
          and ${projects.createdAt} >= ${weekAgo})::int as lessons_started,

      (select count(*) from ${prompts}
        where ${prompts.userId} in ${orgUsers}
          and ${prompts.createdAt} >= ${dayAgo})::int as prompts_today,

      -- Exact, not the old pg_class.reltuples estimate: that is a whole-table
      -- figure and cannot be narrowed to one org. prompts_user_id_created_at_idx
      -- serves the user_id lookup.
      (select count(*) from ${prompts}
        where ${prompts.userId} in ${orgUsers})::int as total_prompts
  `),
    db.execute(sql`
      select array_agg(cnt order by day) as by_day from (
        select gs.day::date as day, count(${prompts.id})::int as cnt
        from generate_series(current_date - interval '13 days', current_date, interval '1 day') gs(day)
        left join ${prompts} on ${prompts.createdAt}::date = gs.day
          and ${prompts.userId} in ${orgUsers}
        group by gs.day
      ) t
    `),
  ])

  const row = rowsOf<Record<string, number | null>>(result)[0] ?? {}
  const promptsByDay = rowsOf<{ by_day: number[] | null }>(trendResult)[0]?.by_day ?? []

  return {
    totalClasses: row.total_classes ?? 0,
    activeStudentCount: row.active_students ?? 0,
    teacherCount: row.teachers ?? 0,
    unpaidCount: row.unpaid ?? 0,
    overdueCount: row.overdue ?? 0,
    lessonsStartedThisWeek: row.lessons_started ?? 0,
    promptsToday: row.prompts_today ?? 0,
    totalPrompts: row.total_prompts ?? 0,
    promptsByDay,
  }
}
