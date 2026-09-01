import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { roles, studentProfiles, userRoles as userRolesTable, users as usersTable } from '@/lib/db/schema'
import { hasPermission } from '@/lib/auth/permissions'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const caller = await getSessionUser()
  if (!caller || !(await hasPermission(caller.id, 'roles:manage'))) redirect('/staff')

  const [allUsers, profiles, roleRows] = await Promise.all([
    // Reads public.users directly. The Supabase Auth admin listing this
    // replaced was paginated at 1000 and silently dropped everyone past it.
    db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable),
    db
      .select({ user_id: studentProfiles.userId, full_name: studentProfiles.fullName })
      .from(studentProfiles),
    // Was PostgREST's embedded `roles(name)`, which nested the joined row and
    // needed a cast to describe. A join says the same thing flatly.
    db
      .select({ user_id: userRolesTable.userId, name: roles.name })
      .from(userRolesTable)
      .innerJoin(roles, eq(roles.id, userRolesTable.roleId)),
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Users</h1>
        <p className="text-sm text-gray-500 mt-0.5">Grant or revoke admin/teacher access. The student role is assigned automatically on sign-in.</p>
      </div>
      <UsersClient users={rows} />
    </div>
  )
}
