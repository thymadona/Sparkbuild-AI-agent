import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, permissions, rolePermissions, roles, userRoles } from '@/lib/db/schema'
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

// The authorization rules, as plain queries. These used to be Postgres
// security-definer functions, a Supabase-era design for RLS policies and RPC
// callers; `db` connects as the owner and no policy calls them, so they now
// live here with the schema's types. Each throws on a database error — the
// exported wrappers and proxy.ts each choose to fail closed or open.

async function holdsRole(userId: string, name: string): Promise<boolean> {
  const rows = await db
    .select({ one: sql`1` })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(roles.name, name)))
    .limit(1)
  return rows.length > 0
}

async function hasClassMembership(
  userId: string,
  role: 'student' | 'teacher',
  classId?: string
): Promise<boolean> {
  const rows = await db
    .select({ one: sql`1` })
    .from(classMembers)
    .where(
      and(
        eq(classMembers.userId, userId),
        eq(classMembers.role, role),
        classId === undefined ? undefined : eq(classMembers.classId, classId)
      )
    )
    .limit(1)
  return rows.length > 0
}

export function queryIsAdmin(userId: string): Promise<boolean> {
  return holdsRole(userId, 'admin')
}

// Admin, or teaches at least one class. A teacher-role holder with no class
// yet does not get the dashboard.
export async function queryCanAccessTeacherDashboard(userId: string): Promise<boolean> {
  const [admin, teaches] = await Promise.all([
    queryIsAdmin(userId),
    hasClassMembership(userId, 'teacher'),
  ])
  return admin || teaches
}

async function queryHasPermission(userId: string, key: string): Promise<boolean> {
  const rows = await db
    .select({ one: sql`1` })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), eq(permissions.key, key)))
    .limit(1)
  return rows.length > 0
}

// Fail closed, unlike lib/ratelimit.ts's checkRateLimit (which fails open —
// worst case there is a missed rate limit). A failure here must deny
// access: this guards admin/PII surfaces, where the safe default is "no
// access", not "any access".
//
// The try/catch has to sit *inside* the cached() callback: cached() does not
// swallow exceptions from its callback, so an uncaught throw here would crash
// the calling page rather than deny access.
export async function hasPermission(userId: string, key: string): Promise<boolean> {
  return cached(`perm:${userId}:${key}`, 30, async () => {
    try {
      return await queryHasPermission(userId, key)
    } catch (err) {
      console.error(`hasPermission(${key}) failed:`, err)
      return false
    }
  })
}

export async function isAdmin(userId: string): Promise<boolean> {
  return cached(`role:admin:${userId}`, 30, async () => {
    try {
      return await queryIsAdmin(userId)
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

// Everything app/staff/layout.tsx needs, batched into two parallel queries
// instead of the seven cached() calls it used to make on every /staff page:
// the user's role names with every permission key those roles carry, and the
// classes they teach. Fails closed like isAdmin/hasPermission, with the
// try/catch inside the cached() callback.
export async function getStaffContext(
  userId: string,
  keys: readonly string[]
): Promise<StaffContext> {
  return cached(`staff:ctx:${userId}:${keys.join(',')}`, 30, async () => {
    try {
      const [grantRows, classRows] = await Promise.all([
        db
          .select({ role: roles.name, key: permissions.key })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .leftJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
          .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
          .where(eq(userRoles.userId, userId)),
        db
          .select({ class_id: classMembers.classId })
          .from(classMembers)
          .where(and(eq(classMembers.userId, userId), eq(classMembers.role, 'teacher'))),
      ])

      const granted = new Set(grantRows.map((r) => r.key))

      return {
        isAdmin: grantRows.some((r) => r.role === 'admin'),
        permissions: Object.fromEntries(keys.map((key) => [key, granted.has(key)])),
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
    const [teaches, admin] = await Promise.all([
      hasClassMembership(userId, 'teacher', classId),
      queryIsAdmin(userId),
    ])
    return teaches || admin
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
