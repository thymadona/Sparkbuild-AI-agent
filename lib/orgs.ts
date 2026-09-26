import { and, eq, notExists, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { PLATFORM_ADMIN_ROLE_ID, classes, organizations, userRoles, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/db/schemas/organizations'

export { DIRECT_ORG_ID, DIRECT_ORG_SLUG } from '@/lib/db/schemas/organizations'

// A row that belongs to a user (an invoice, a role grant) lives in that
// user's org. Used as an insert value, this resolves the org in the same
// statement, so there is no read-then-write gap; an unknown user yields NULL
// and the insert fails on the NOT NULL / FK rather than landing in some org.
export function orgOfUser(userId: string) {
  return sql<string>`(select ${users.orgId} from ${users} where ${eq(users.id, userId)})`
}

// Child tables (profiles, members, schedules, projects, prompts…) carry no
// org_id; they reach it through their user or class. A staff query scopes one
// with `inArray(child.userId, usersInOrg(orgId))` or
// `inArray(child.classId, classesInOrg(orgId))`, so the org predicate sits in
// the same statement's where clause. orgId may be a value or orgOfUser().
export function usersInOrg(orgId: string | ReturnType<typeof orgOfUser>) {
  return db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId))
}

export function classesInOrg(orgId: string | ReturnType<typeof orgOfUser>) {
  return db.select({ id: classes.id }).from(classes).where(eq(classes.orgId, orgId))
}

// True if the class exists in this org. Throws on a database error, like any
// query; the caller picks fail-open or closed.
export async function classInOrg(classId: string, orgId: string): Promise<boolean> {
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.orgId, orgId)))
    .limit(1)
  return rows.length > 0
}

// True if this user is paused because their org is suspended. SparkBuild
// Direct is never suspended, so its users cost no query. The platform owner
// is never paused, so they can always reach /console to lift a suspension.
// Throws on a database error; getSessionUser fails closed for school orgs.
export async function isSuspendedFor(userId: string, orgId: string): Promise<boolean> {
  if (orgId === DIRECT_ORG_ID) return false
  const rows = await db
    .select({ one: sql`1` })
    .from(organizations)
    .where(
      and(
        eq(organizations.id, orgId),
        eq(organizations.status, 'suspended'),
        notExists(
          db
            .select({ one: sql`1` })
            .from(userRoles)
            .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, PLATFORM_ADMIN_ROLE_ID)))
        )
      )
    )
    .limit(1)
  return rows.length > 0
}
