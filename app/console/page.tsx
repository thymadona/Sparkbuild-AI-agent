import { DIRECT_ORG_ID } from '@/lib/orgs'
import ConsoleClient from './ConsoleClient'
import { loadOrgs } from './orgs-data'

export default async function ConsolePage() {
  const orgs = await loadOrgs()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Organizations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Create a school, name its admin by email, and pause or restore its access.
        </p>
      </div>
      <ConsoleClient orgs={orgs} directOrgId={DIRECT_ORG_ID} />
    </div>
  )
}
