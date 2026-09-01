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
} from '@/lib/db/schema'

const WEEK_MS = 7 * 86_400_000

export interface SchoolOverviewStats {
  totalClasses: number
  activeStudentCount: number
  teacherCount: number
  needsReview: number
  unpaidCount: number
  overdueCount: number
  lessonsStartedThisWeek: number
  submittedThisWeek: number
  promptsToday: number
  totalPrompts: number
}

// One round trip for the whole dashboard: ten scalar subqueries in a single
// SELECT rather than ten queries in a Promise.all. Counting happens in
// Postgres, and the page pays one connection however many tiles it grows.
// Names are interpolated from lib/db/schema.ts so renames propagate.
// count() returns bigint, which the driver hands back as a string — hence ::int.
export async function getSchoolOverviewStats(): Promise<SchoolOverviewStats> {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const today = new Date().toISOString().split('T')[0]
  const staffRoles = sql.join(
    STAFF_ROLES.map((role) => sql`${role}`),
    sql`, `
  )

  const result = await db.execute(sql`
    select
      (select count(*) from ${classes})::int as total_classes,

      -- user_roles holds a 'student' row for every non-staff account, so a
      -- profile owner who also holds a staff role is not a student.
      (select count(*) from ${studentProfiles}
        where ${studentProfiles.isActive} = true
          and not exists (
            select 1 from ${userRoles}
            join ${roles} on ${roles.id} = ${userRoles.roleId}
            where ${userRoles.userId} = ${studentProfiles.userId}
              and ${roles.name} in (${staffRoles})
          ))::int as active_students,

      -- Distinct, because one person can teach several classes.
      (select count(distinct ${classMembers.userId}) from ${classMembers}
        where ${classMembers.role} = 'teacher')::int as teachers,

      (select count(*) from ${projects}
        where ${projects.submissionStatus} = 'submitted')::int as needs_review,

      (select count(*) from ${invoices}
        where ${invoices.status} = 'unpaid')::int as unpaid,
      (select count(*) from ${invoices}
        where ${invoices.status} = 'unpaid'
          and ${invoices.dueDate} < ${today})::int as overdue,

      (select count(*) from ${projects}
        where ${projects.lessonId} is not null
          and ${projects.createdAt} >= ${weekAgo})::int as lessons_started,
      (select count(*) from ${projects}
        where ${projects.submissionStatus} is not null
          and ${projects.updatedAt} >= ${weekAgo})::int as submitted_week,

      (select count(*) from ${prompts}
        where ${prompts.createdAt} >= ${dayAgo})::int as prompts_today,

      -- The tile is labelled an estimate, and an unfiltered count(*) here can
      -- only ever be a seq scan. reltuples is -1 until the table is analyzed;
      -- only then does the caller pay for an exact count.
      (select reltuples::bigint::int from pg_class
        where oid = 'public.prompts'::regclass) as prompts_estimate
  `)

  const row = rowsOf<Record<string, number | null>>(result)[0] ?? {}
  const promptsEstimate = row.prompts_estimate ?? -1

  return {
    totalClasses: row.total_classes ?? 0,
    activeStudentCount: row.active_students ?? 0,
    teacherCount: row.teachers ?? 0,
    needsReview: row.needs_review ?? 0,
    unpaidCount: row.unpaid ?? 0,
    overdueCount: row.overdue ?? 0,
    lessonsStartedThisWeek: row.lessons_started ?? 0,
    submittedThisWeek: row.submitted_week ?? 0,
    promptsToday: row.prompts_today ?? 0,
    totalPrompts: promptsEstimate >= 0 ? promptsEstimate : await db.$count(prompts),
  }
}
