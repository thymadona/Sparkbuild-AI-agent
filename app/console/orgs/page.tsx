import PageHeader from '@/components/dashboard/PageHeader'
import { HeroMetric } from '@/app/staff/OverviewWidgets'
import { estimateCost, getAiUsage } from '@/lib/ai-usage'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import NewSchoolDialog from './NewSchoolDialog'
import OrgsTable from './OrgsTable'
import { loadOrgs } from './orgs-data'

export default async function OrgsPage() {
  const [orgs, ai] = await Promise.all([loadOrgs(), getAiUsage()])

  return (
    <div>
      <PageHeader
        title="All Organizations"
        description="Every org on the platform. Open one to manage its admins or pause it."
        actions={<NewSchoolDialog />}
      />
      <div className="mb-6">
        <HeroMetric
          label="AI requests today, all organizations"
          value={ai.today.toLocaleString()}
          sub={`${ai.total.toLocaleString()} all-time · ~${estimateCost(ai.total)} estimated cost`}
          trend={ai.byDay}
        />
      </div>
      <OrgsTable orgs={orgs} directOrgId={DIRECT_ORG_ID} />
    </div>
  )
}
