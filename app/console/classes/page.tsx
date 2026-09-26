import PageHeader from '@/components/dashboard/PageHeader'
import { loadAllClasses, loadOrgOptions } from '../platform-data'
import AllClassesTable from './AllClassesTable'

// Cross-org and read-only; app/console/layout.tsx already required platform_admin.
export default async function AllClassesPage(props: { searchParams: Promise<{ org?: string }> }) {
  const [{ org }, classes, orgs] = await Promise.all([
    props.searchParams,
    loadAllClasses(),
    loadOrgOptions(),
  ])

  return (
    <div>
      <PageHeader
        title="All Classes"
        description="Every class in every organization. Read-only here: each school's admins manage their own in /staff."
      />
      <AllClassesTable classes={classes} orgs={orgs} initialOrg={org} />
    </div>
  )
}
