import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller || !(await hasPermission(caller.id, 'roles:manage'))) redirect('/staff')

  const [{ data: usersData }, { data: profiles }, { data: userRoles }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('student_profiles').select('user_id, full_name'),
    supabaseAdmin.from('user_roles').select('user_id, roles(name)'),
  ])

  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name]))
  const rolesById: Record<string, string[]> = {}
  for (const row of (userRoles ?? []) as unknown as { user_id: string; roles: { name: string } }[]) {
    if (!rolesById[row.user_id]) rolesById[row.user_id] = []
    rolesById[row.user_id].push(row.roles.name)
  }

  const rows = (usersData?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? u.id,
      fullName: nameById[u.id] ?? '',
      roles: rolesById[u.id] ?? [],
    }))
    .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Users</h1>
        <p className="text-sm text-gray-500 mt-0.5">Grant or revoke admin/teacher access.</p>
      </div>
      <UsersClient users={rows} />
    </div>
  )
}
