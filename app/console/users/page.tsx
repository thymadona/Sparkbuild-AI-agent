import PageHeader from '@/components/dashboard/PageHeader'
import { loadAllUsers, loadOrgOptions } from '../platform-data'
import AllUsersTable from './AllUsersTable'

// Cross-org and read-only; app/console/layout.tsx already required platform_admin.
export default async function AllUsersPage(props: { searchParams: Promise<{ org?: string }> }) {
  const [{ org }, users, orgs] = await Promise.all([
    props.searchParams,
    loadAllUsers(),
    loadOrgOptions(),
  ])

  return (
    <div>
      <PageHeader
        title="All Users"
        description="Everyone on the platform and their roles. Read-only here: each school's admins manage their own in /staff."
      />
      <AllUsersTable users={users} orgs={orgs} initialOrg={org} />
    </div>
  )
}
