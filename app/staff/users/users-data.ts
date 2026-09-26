import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  roles,
  studentProfiles,
  userRoles as userRolesTable,
  users as usersTable,
} from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { usersInOrg } from '@/lib/orgs'

// Everything /staff/users lists, for one org: its users, their profiles and
// every role they hold (an org-less platform_admin grant included, so the
// page shows it).
export async function loadUsers(orgId: string) {
  const [allUsers, profiles, roleRows] = await Promise.all([
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
    // Was PostgREST's embedded `roles(name)`, which nested the joined row and
    // needed a cast to describe. A join says the same thing flatly.
    db
      .select({ user_id: userRolesTable.userId, name: roles.name })
      .from(userRolesTable)
      .innerJoin(roles, eq(roles.id, userRolesTable.roleId))
      .where(inArray(userRolesTable.userId, usersInOrg(orgId))),
  ])

  const nameById = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name]))
  const rolesById: Record<string, string[]> = {}
  for (const row of roleRows) {
    if (!rolesById[row.user_id]) rolesById[row.user_id] = []
    rolesById[row.user_id].push(row.name)
  }

  const rows = allUsers
    .map((u) => ({
      id: u.id,
      email: u.email || u.id,
      fullName: nameById[u.id] ?? '',
      roles: rolesById[u.id] ?? [],
    }))
    .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email))

  return rows
}

// One user of the org for /staff/users/[id]; null for a malformed id or
// someone outside the org (the page answers 404).
export async function loadUser(orgId: string, id: string) {
  if (!isUuid(id)) return null
  const [[user], [profile], roleRows] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.orgId, orgId)))
      .limit(1),
    db
      .select({ fullName: studentProfiles.fullName, isActive: studentProfiles.isActive })
      .from(studentProfiles)
      .where(
        and(eq(studentProfiles.userId, id), inArray(studentProfiles.userId, usersInOrg(orgId)))
      )
      .limit(1),
    db
      .select({ name: roles.name })
      .from(userRolesTable)
      .innerJoin(roles, eq(roles.id, userRolesTable.roleId))
      .where(and(eq(userRolesTable.userId, id), inArray(userRolesTable.userId, usersInOrg(orgId)))),
  ])
  if (!user) return null
  return {
    ...user,
    fullName: profile?.fullName || user.name || '',
    hasProfile: !!profile,
    isActive: profile?.isActive ?? true,
    roles: roleRows.map((r) => r.name),
  }
}
