import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/permissions'
import UsersClient from './UsersClient'
import { loadUsers } from './users-data'
import { loadPendingInvites } from '@/lib/org-invites'
import AddPeoplePanel from './AddPeoplePanel'
import PendingInvites from './PendingInvites'

export default async function UsersPage() {
  const caller = await getSessionUser()
  if (!caller || !(await hasPermission(caller.id, 'roles:manage'))) redirect('/staff')

  const [rows, invites] = await Promise.all([
    loadUsers(caller.orgId),
    loadPendingInvites(caller.orgId),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add students and teachers by email or CSV, and grant or revoke admin/teacher access.
        </p>
      </div>
      <div className="space-y-6">
        <AddPeoplePanel />
        <PendingInvites invites={invites} />
        <UsersClient users={rows} />
      </div>
    </div>
  )
}
