import PageHeader from '@/components/dashboard/PageHeader'
import { loadAllStudents, loadOrgOptions } from '../platform-data'
import AllStudentsTable from './AllStudentsTable'

// Cross-org and read-only; app/console/layout.tsx already required platform_admin.
export default async function AllStudentsPage(props: { searchParams: Promise<{ org?: string }> }) {
  const [{ org }, students, orgs] = await Promise.all([
    props.searchParams,
    loadAllStudents(),
    loadOrgOptions(),
  ])

  return (
    <div>
      <PageHeader
        title="All Students"
        description="Every student in every organization. Read-only here: each school's admins manage their own in /staff."
      />
      <AllStudentsTable students={students} orgs={orgs} initialOrg={org} />
    </div>
  )
}
