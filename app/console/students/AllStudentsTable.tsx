'use client'

import DataTable from '@/components/dashboard/DataTable'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { estimateCost } from '@/lib/ai-cost'
import { formatDate } from '@/lib/format'
import { orgColumn, orgFilter } from '../org-column'
import type { OrgOption, PlatformStudent } from '../platform-data'

export default function AllStudentsTable({
  students,
  orgs,
  initialOrg,
}: {
  students: PlatformStudent[]
  orgs: OrgOption[]
  initialOrg?: string
}) {
  return (
    <DataTable
      rows={students}
      getRowId={(s) => s.id}
      rowHref={(s) => `/console/orgs/${s.orgId}`}
      noun="students"
      emptyText="No students in any organization yet."
      search={{ placeholder: 'Search name or email', text: (s) => `${s.name} ${s.email}` }}
      filters={[
        orgFilter(orgs),
        {
          id: 'status',
          label: 'Status',
          options: [
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
          match: (s, v) => (v === 'active') === s.isActive,
        },
        {
          id: 'class',
          label: 'Class',
          options: [
            { value: 'all', label: 'All' },
            { value: 'in', label: 'In a class' },
            { value: 'none', label: 'No class' },
          ],
          match: (s, v) => (v === 'in') === s.classes > 0,
        },
      ]}
      initialFilters={{ org: initialOrg }}
      columns={[
        {
          id: 'name',
          header: 'Student',
          sortValue: (s) => (s.name || s.email).toLowerCase(),
          cell: (s) => (
            <div>
              <div className="font-medium text-foreground">
                {s.name || <span className="italic text-muted-foreground/70">No name</span>}
              </div>
              <div className="text-xs text-muted-foreground">{s.email}</div>
            </div>
          ),
        },
        orgColumn(),
        {
          id: 'classes',
          header: 'Classes',
          className: 'text-right',
          sortValue: (s) => s.classes,
          cell: (s) => <span className="tabular-nums">{s.classes}</span>,
        },
        {
          id: 'ai',
          header: 'AI requests',
          className: 'text-right',
          sortValue: (s) => s.aiRequests,
          cell: (s) => (
            <span className="tabular-nums" title={`~${estimateCost(s.aiRequests)} estimated`}>
              {s.aiRequests.toLocaleString()}
            </span>
          ),
        },
        {
          id: 'status',
          header: 'Status',
          sortValue: (s) => (s.isActive ? 0 : 1),
          cell: (s) => <StatusBadge status={s.isActive ? 'active' : 'inactive'} />,
        },
        {
          id: 'joined',
          header: 'Joined',
          className: 'text-right',
          sortValue: (s) => s.createdAt,
          cell: (s) => (
            <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
          ),
        },
      ]}
    />
  )
}
