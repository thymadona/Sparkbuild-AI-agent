'use client'

import { Building2Icon, StoreIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { estimateCost } from '@/lib/ai-cost'
import { formatDate } from '@/lib/format'
import type { ConsoleOrg } from './orgs-data'

export default function OrgsTable({
  orgs,
  directOrgId,
}: {
  orgs: ConsoleOrg[]
  directOrgId: string
}) {
  return (
    <DataTable
      rows={orgs}
      getRowId={(o) => o.id}
      rowHref={(o) => `/console/orgs/${o.id}`}
      noun="organizations"
      emptyText="No organizations yet."
      search={{
        placeholder: 'Search by name or slug',
        text: (o) => `${o.name} ${o.slug}`,
      }}
      filters={[
        {
          id: 'status',
          label: 'Status',
          options: [
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Paused' },
          ],
          match: (o, v) => o.status === v,
        },
        {
          id: 'kind',
          label: 'Type',
          options: [
            { value: 'all', label: 'All types' },
            { value: 'school', label: 'School' },
            { value: 'direct', label: 'Direct (B2C)' },
          ],
          match: (o, v) => (v === 'direct') === (o.id === directOrgId),
        },
      ]}
      columns={[
        {
          id: 'name',
          header: 'Organization',
          sortValue: (o) => o.name.toLowerCase(),
          cell: (o) => {
            const Icon = o.id === directOrgId ? StoreIcon : Building2Icon
            return (
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-medium text-foreground">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.slug}</div>
                </div>
              </div>
            )
          },
        },
        {
          id: 'status',
          header: 'Status',
          sortValue: (o) => o.status,
          cell: (o) => <StatusBadge status={o.status === 'active' ? 'active' : 'paused'} />,
        },
        {
          id: 'members',
          header: 'Members',
          className: 'text-right',
          sortValue: (o) => o.members,
          cell: (o) => <span className="tabular-nums">{o.members}</span>,
        },
        {
          id: 'classes',
          header: 'Classes',
          className: 'text-right',
          sortValue: (o) => o.classes,
          cell: (o) => <span className="tabular-nums">{o.classes}</span>,
        },
        {
          id: 'ai',
          header: 'AI requests',
          className: 'text-right',
          sortValue: (o) => o.aiRequests,
          cell: (o) => (
            <span className="tabular-nums" title={`~${estimateCost(o.aiRequests)} estimated`}>
              {o.aiRequests.toLocaleString()}
            </span>
          ),
        },
        {
          id: 'admins',
          header: 'Admins',
          cell: (o) =>
            o.admins.length === 0 ? (
              <span className="text-xs text-muted-foreground/70">
                {o.pendingInvites.length > 0 ? 'Invite pending' : 'None yet'}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {o.admins[0].email}
                {o.admins.length > 1 && ` +${o.admins.length - 1}`}
              </span>
            ),
        },
        {
          id: 'created',
          header: 'Created',
          className: 'text-right',
          sortValue: (o) => o.createdAt,
          cell: (o) => (
            <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
          ),
        },
      ]}
    />
  )
}
