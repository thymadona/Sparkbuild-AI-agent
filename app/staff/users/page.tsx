import { redirect } from 'next/navigation'
import PageHeader from '@/components/dashboard/PageHeader'
import { getSessionUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/permissions'
import { loadPendingInvites } from '@/lib/org-invites'
import { AddPersonDialog, ImportPeopleDialog } from './AddPeopleDialogs'
import PendingInvites from './PendingInvites'
import UsersClient from './UsersClient'
import { loadUsers } from './users-data'

export default async function UsersPage() {
  const caller = await getSessionUser()
  if (!caller || !(await hasPermission(caller.id, 'roles:manage'))) redirect('/staff')

  const [rows, invites] = await Promise.all([
    loadUsers(caller.orgId),
    loadPendingInvites(caller.orgId),
  ])

  return (
    <div>
      <PageHeader
        title="People & Roles"
        description="Add students and teachers by email or CSV. Open a person to change their roles."
        actions={
          <>
            <ImportPeopleDialog />
            <AddPersonDialog />
          </>
        }
      />
      <div className="space-y-6">
        <UsersClient users={rows} />
        <PendingInvites invites={invites} />
      </div>
    </div>
  )
}
