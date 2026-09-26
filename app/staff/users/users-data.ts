import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  roles,
  studentProfiles,
  userRoles as userRolesTable,
  users as usersTable,
} from '@/lib/db/schema'
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
