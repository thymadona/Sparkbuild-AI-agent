import { and, count, countDistinct, eq, gte, inArray, isNotNull, notExists, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
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

// `prompts` is the largest table in the schema (one row per AI request, ever)
// and an unfiltered count(*) can only ever be a sequential scan of it. The
// tile this feeds is already labelled an estimate and only multiplies out an
// average token cost, so the planner's own row estimate is accurate enough —
// and it is O(1). reltuples is -1 on a table that has never been analyzed,
// which is the one case worth an exact count: on such a table it is cheap by
// definition.
async function estimatePromptCount(): Promise<number> {
  try {
    const rows = (await db.execute(
      sql`select reltuples::bigint::int as n from pg_class where oid = 'public.prompts'::regclass`
    )) as unknown as { n: number | null }[]

    const estimate = rows[0]?.n ?? -1
    return estimate >= 0 ? estimate : await db.$count(prompts)
  } catch (err) {
    console.error('estimatePromptCount failed:', err)
    return 0
  }
}

// Split out of OverviewTab so these counts are testable against the real
// database instead of being re-implemented in a test file — the queries here
// are the ones that ship. Colocated under app/staff/ per the repo's
// colocation rule: this is specific to the route, not shared UI.
//
// Every stat is counted *in Postgres*. An earlier version selected whole
// tables (active profiles, teacher memberships, staff role rows, unpaid
// invoices) and took .size/.length/.filter().length in JS, pulling every row
// across the wire to produce a single integer — ten such queries at once,
// against a connection pool deliberately sized small for serverless.
//
// db.$count issues a real count(*). PostgREST counted with
// `select('*', { count: 'exact', head: true })`, which still planned a full
// select and threw every row away.
export async function getSchoolOverviewStats(): Promise<SchoolOverviewStats> {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const today = new Date().toISOString().split('T')[0]

  const [
    totalClasses,
    activeStudentCount,
    teacherRows,
    needsReview,
    invoiceRows,
    lessonsStartedThisWeek,
    submittedThisWeek,
    promptsToday,
    totalPrompts,
  ] = await Promise.all([
    db.$count(classes),
    // user_roles now holds a 'student' row for every non-staff account
    // (lib/auth/student-defaults.ts), so "has a user_roles row" no longer
    // means "is staff" — hence the STAFF_ROLES filter. A profile can exist for
    // someone who also holds a staff role (a teacher's own test account, say);
    // they are not a student. That was a second full-table select plus a JS
    // set difference; it is now one anti-join.
    db.$count(
      studentProfiles,
      and(
        eq(studentProfiles.isActive, true),
        notExists(
          db
            .select({ one: sql`1` })
            .from(userRoles)
            .innerJoin(roles, eq(roles.id, userRoles.roleId))
            .where(
              and(
                eq(userRoles.userId, studentProfiles.userId),
                inArray(roles.name, [...STAFF_ROLES])
              )
            )
        )
      )
    ),
    // Distinct, because one person can teach several classes.
    db
      .select({ n: countDistinct(classMembers.userId) })
      .from(classMembers)
      .where(eq(classMembers.role, 'teacher')),
    db.$count(projects, eq(projects.submissionStatus, 'submitted')),
    // Both invoice numbers in one pass rather than fetching every unpaid row
    // and filtering on due_date in JS.
    db
      .select({
        unpaid: count(),
        overdue: sql<number>`count(*) filter (where ${invoices.dueDate} < ${today})::int`,
      })
      .from(invoices)
      .where(eq(invoices.status, 'unpaid')),
    db.$count(projects, and(isNotNull(projects.lessonId), gte(projects.createdAt, weekAgo))),
    db.$count(
      projects,
      and(isNotNull(projects.submissionStatus), gte(projects.updatedAt, weekAgo))
    ),
    db.$count(prompts, gte(prompts.createdAt, dayAgo)),
    estimatePromptCount(),
  ])

  return {
    totalClasses: totalClasses ?? 0,
    activeStudentCount,
    teacherCount: teacherRows[0]?.n ?? 0,
    needsReview: needsReview ?? 0,
    unpaidCount: invoiceRows[0]?.unpaid ?? 0,
    overdueCount: invoiceRows[0]?.overdue ?? 0,
    lessonsStartedThisWeek: lessonsStartedThisWeek ?? 0,
    submittedThisWeek: submittedThisWeek ?? 0,
    promptsToday: promptsToday ?? 0,
    totalPrompts,
  }
}
