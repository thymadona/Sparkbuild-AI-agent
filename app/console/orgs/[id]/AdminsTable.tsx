'use client'

import DataTable from '@/components/dashboard/DataTable'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatDate } from '@/lib/format'

export type AdminRow = {
  email: string
  name: string
  status: 'active' | 'pending'
  since: string | null
}

export default function AdminsTable({ rows }: { rows: AdminRow[] }) {
  return (
    <DataTable
      rows={rows}
      getRowId={(r) => `${r.status}:${r.email}`}
      noun="admins"
      emptyText="No admins yet. Add one to hand the school over."
      search={{ placeholder: 'Search admins', text: (r) => `${r.name} ${r.email}` }}
      filters={[
        {
          id: 'status',
          label: 'Status',
          options: [
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Admin' },
            { value: 'pending', label: 'Invite pending' },
          ],
          match: (r, v) => r.status === v,
        },
      ]}
      columns={[
        {
          id: 'email',
          header: 'Admin',
          sortValue: (r) => r.email,
          cell: (r) => (
            <div>
              <div className="font-medium text-foreground">{r.name || r.email}</div>
              {r.name && r.name !== r.email && (
                <div className="text-xs text-muted-foreground">{r.email}</div>
              )}
            </div>
          ),
        },
        {
          id: 'status',
          header: 'Status',
          cell: (r) =>
            r.status === 'active' ? (
              <StatusBadge status="active" label="Admin" />
            ) : (
              <StatusBadge status="pending" label="Invite pending" />
            ),
        },
        {
          id: 'since',
          header: 'Invited',
          className: 'text-right',
          cell: (r) => (
            <span className="text-xs text-muted-foreground">
              {r.since ? formatDate(r.since) : '—'}
            </span>
          ),
        },
      ]}
    />
  )
}
