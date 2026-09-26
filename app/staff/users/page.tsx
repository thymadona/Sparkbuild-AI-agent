import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/permissions'
import UsersClient from './UsersClient'
import { loadUsers } from './users-data'

export default async function UsersPage() {
  const caller = await getSessionUser()
  if (!caller || !(await hasPermission(caller.id, 'roles:manage'))) redirect('/staff')

  const rows = await loadUsers(caller.orgId)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Grant or revoke admin/teacher access. The student role is assigned automatically on
          sign-in.
        </p>
      </div>
      <UsersClient users={rows} />
    </div>
  )
}
