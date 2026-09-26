import { notFound } from 'next/navigation'
import PageHeader from '@/components/dashboard/PageHeader'
import StatCard from '@/components/dashboard/StatCard'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { estimateCost, getAiUsage } from '@/lib/ai-usage'
import { loadOrg } from '../orgs-data'
import AdminsTable, { type AdminRow } from './AdminsTable'
import { AddAdminDialog, StatusButton } from './OrgActions'

export default async function OrgDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  // loadOrg checks isUuid; the console layout already required platform_admin.
  const org = await loadOrg(id)
  if (!org) notFound()
  const ai = await getAiUsage(org.id)

  const isDirect = org.id === DIRECT_ORG_ID
  const admins: AdminRow[] = [
    ...org.admins.map((a) => ({ ...a, status: 'active' as const, since: null })),
    ...org.pendingInvites
      .filter((i) => i.role === 'admin')
      .map((i) => ({ email: i.email, name: '', status: 'pending' as const, since: i.createdAt })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/console/orgs"
        title={org.name}
        badge={<StatusBadge status={org.status === 'active' ? 'active' : 'paused'} />}
        description={isDirect ? 'SparkBuild Direct, the built-in B2C org' : `School · ${org.slug}`}
        actions={
          <>
            {!isDirect && <StatusButton orgId={org.id} name={org.name} status={org.status} />}
            <AddAdminDialog orgId={org.id} name={org.name} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon="users"
          label="Members"
          value={org.members}
          href={`/console/users?org=${org.id}`}
        />
        <StatCard
          icon="classes"
          label="Classes"
          value={org.classes}
          href={`/console/classes?org=${org.id}`}
        />
        <StatCard icon="admins" label="Admins" value={org.admins.length} />
        <StatCard icon="invites" label="Pending invites" value={org.pendingInvites.length} />
        <StatCard
          icon="ai"
          label="AI requests"
          value={ai.total.toLocaleString()}
          hint={`${ai.today.toLocaleString()} today · ~${estimateCost(ai.total)}`}
        />
      </div>

      <Card>
        <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Slug</span>
            <p className="mt-0.5 font-mono text-foreground">{org.slug}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Access</span>
            <p className="mt-0.5 text-foreground">
              {isDirect ? 'Self-paced (boss unlocks)' : 'Class-only'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Created</span>
            <p className="mt-0.5 text-foreground">{formatDate(org.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Admins</h2>
        <AdminsTable rows={admins} />
      </section>
    </div>
  )
}
