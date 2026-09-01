import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, roles, userRoles } from '@/lib/db/schema'
import { cached } from '@/lib/cache'

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

// The roles that mean "this account is staff". `student` is deliberately
// absent: every non-staff account now holds a student row in user_roles
// (lib/auth/student-defaults.ts), so "has any user_roles row" is no longer a
// test for staff. The four pages under app/staff/ match on this list instead,
// so a new staff role added here is picked up by all of them at once.
export const STAFF_ROLES = ['admin', 'teacher'] as const

// Looks up a seeded role's id by name, or null when that role is missing —
// a database that has not had drizzle/0004_student_role.sql applied. Callers
// degrade on null rather than throwing, because ensureStudentDefaults must
// never block a sign-in over a missing role row.
export async function roleIdByName(name: string): Promise<string | null> {
  const [row] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1)
  return row?.id ?? null
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))

  return rows.map((row) => row.name)
}

// The authorization checks below run as Postgres security-definer functions
// (drizzle/0001_functions_sequence_seed.sql) rather than as Drizzle queries.
// Those functions already encode the rules — including the teacher exemption
// in is_enrolled_in_class that exists specifically to fix a bug — and
// reimplementing multi-table joins on the app's authorization boundary would
// be new places to get it wrong.
async function callBooleanFn(query: ReturnType<typeof sql>): Promise<boolean> {
  const rows = (await db.execute(query)) as unknown as { ok: boolean | null }[]
  return rows[0]?.ok === true
}

// Fail closed, unlike lib/ratelimit.ts's checkRateLimit (which fails open —
// worst case there is a missed rate limit). A failure here must deny
// access: this guards admin/PII surfaces, where the safe default is "no
// access", not "any access".
//
// The try/catch has to sit *inside* the cached() callback. Drizzle throws
// where the old Supabase client returned `{ data, error }`, and cached()
// does not swallow exceptions from its callback — so an uncaught throw here
// would crash the calling page rather than deny access.
export async function hasPermission(userId: string, key: string): Promise<boolean> {
  return cached(`perm:${userId}:${key}`, 30, async () => {
    try {
      return await callBooleanFn(sql`select public.has_permission(${userId}::uuid, ${key}) as ok`)
    } catch (err) {
      console.error(`hasPermission(${key}) failed:`, err)
      return false
    }
  })
}

export async function isAdmin(userId: string): Promise<boolean> {
  return cached(`role:admin:${userId}`, 30, async () => {
    try {
      return await callBooleanFn(sql`select public.is_admin(${userId}::uuid) as ok`)
    } catch (err) {
      console.error('isAdmin failed:', err)
      return false
    }
  })
}

// True if userId holds the teacher role, regardless of class assignment —
// used to exempt teachers from the per-class lesson-enabled toggle, which is
// meant to gate students, not the teachers who set it. Fails closed like
// isAdmin, rather than throwing like getUserRoles, so a lookup failure here
// denies the bypass instead of crashing the page/route calling it.
export async function isTeacher(userId: string): Promise<boolean> {
  return cached(`role:teacher:${userId}`, 30, async () => {
    try {
      return (await getUserRoles(userId)).includes('teacher')
    } catch {
      return false
    }
  })
}

export interface StaffContext {
  isAdmin: boolean
  // Keyed by the permission keys passed in, so a caller reads back exactly
  // what it asked for. A key that could not be resolved is false, never absent.
  permissions: Record<string, boolean>
  teacherClassIds: string[]
}

// Everything app/staff/layout.tsx needs, in one round trip instead of seven.
//
// That layout runs on every page under /staff, and it used to call isAdmin +
// hasPermission x5 + getTeacherClassIds concurrently. Each of those is its own
// cached() wrapper, so a cold cache meant seven simultaneous claimants on a
// connection pool deliberately sized small for serverless (lib/db/client.ts).
// That fan-out — not any single slow query — is what made the whole /staff
// tree hang in production while localhost, whose `max: 1` pool serializes
// everything against a local Postgres, was fine.
//
// This does NOT reimplement the authorization rules. It calls the same
// security-definer functions as isAdmin/hasPermission, batched into a single
// SELECT, so each rule still has exactly one definition
// (drizzle/0001_functions_sequence_seed.sql) — the reason those functions
// exist rather than Drizzle joins, per the note above callBooleanFn.
//
// Fails closed like its single-check counterparts, with the try/catch inside
// the cached() callback for the reason given above hasPermission.
export async function getStaffContext(
  userId: string,
  keys: readonly string[]
): Promise<StaffContext> {
  return cached(`staff:ctx:${userId}:${keys.join(',')}`, 30, async () => {
    try {
      // Aliased positionally rather than by key: a permission key contains a
      // colon, and quoting caller-supplied text into an identifier is a habit
      // worth not forming even where the input is a local constant.
      const columns = keys.map(
        (key, i) =>
          sql`public.has_permission(${userId}::uuid, ${key}) as ${sql.identifier(`p${i}`)}`
      )

      const [rows, classRows] = await Promise.all([
        db.execute(
          sql`select ${sql.join([sql`public.is_admin(${userId}::uuid) as is_admin`, ...columns], sql`, `)}`
        ),
        db
          .select({ class_id: classMembers.classId })
          .from(classMembers)
          .where(and(eq(classMembers.userId, userId), eq(classMembers.role, 'teacher'))),
      ])

      const row = (rows as unknown as Record<string, boolean | null>[])[0] ?? {}

      return {
        isAdmin: row.is_admin === true,
        permissions: Object.fromEntries(keys.map((key, i) => [key, row[`p${i}`] === true])),
        teacherClassIds: classRows.map((r) => r.class_id),
      }
    } catch (err) {
      console.error('getStaffContext failed:', err)
      return {
        isAdmin: false,
        permissions: Object.fromEntries(keys.map((key) => [key, false])),
        teacherClassIds: [],
      }
    }
  })
}

export async function requirePermission(userId: string, key: string): Promise<void> {
  if (!(await hasPermission(userId, key))) {
    throw new ForbiddenError(`Missing permission: ${key}`)
  }
}

// True if userId teaches this specific class, or is an admin.
export async function isTeacherOfClass(userId: string, classId: string): Promise<boolean> {
  try {
    return await callBooleanFn(
      sql`select public.is_teacher_of_class(${userId}::uuid, ${classId}::uuid) as ok`
    )
  } catch (err) {
    console.error('isTeacherOfClass failed:', err)
    return false
  }
}

// Class ids this user teaches. Does NOT include "all classes" for admins —
// callers needing admin-sees-everything should check isAdmin() separately.
export async function getTeacherClassIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ class_id: classMembers.classId })
    .from(classMembers)
    .where(and(eq(classMembers.userId, userId), eq(classMembers.role, 'teacher')))

  return rows.map((row) => row.class_id)
}
