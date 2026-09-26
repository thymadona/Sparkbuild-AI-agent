'use client'

import { GraduationCapIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import { formatDate } from '@/lib/format'
import { orgColumn, orgFilter } from '../org-column'
import type { OrgOption, PlatformClass } from '../platform-data'

export default function AllClassesTable({
  classes,
  orgs,
  initialOrg,
}: {
  classes: PlatformClass[]
  orgs: OrgOption[]
  initialOrg?: string
}) {
  return (
    <DataTable
      rows={classes}
      getRowId={(c) => c.id}
      rowHref={(c) => `/console/orgs/${c.orgId}`}
      noun="classes"
      emptyText="No classes in any organization yet."
      search={{ placeholder: 'Search classes', text: (c) => `${c.name} ${c.description ?? ''}` }}
      filters={[
        orgFilter(orgs),
        {
          id: 'teacher',
          label: 'Teacher',
          options: [
            { value: 'all', label: 'All' },
            { value: 'yes', label: 'Has a teacher' },
            { value: 'no', label: 'No teacher' },
          ],
          match: (c, v) => (v === 'yes') === c.teachers > 0,
        },
      ]}
      initialFilters={{ org: initialOrg }}
      columns={[
        {
          id: 'name',
          header: 'Class',
          sortValue: (c) => c.name.toLowerCase(),
          cell: (c) => (
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <GraduationCapIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{c.name}</div>
                {c.description && (
                  <div className="max-w-xs truncate text-xs text-muted-foreground">
                    {c.description}
                  </div>
                )}
              </div>
            </div>
          ),
        },
        orgColumn(),
        {
          id: 'teachers',
          header: 'Teachers',
          className: 'text-right',
          sortValue: (c) => c.teachers,
          cell: (c) => <span className="tabular-nums">{c.teachers}</span>,
        },
        {
          id: 'students',
          header: 'Students',
          className: 'text-right',
          sortValue: (c) => c.students,
          cell: (c) => <span className="font-medium tabular-nums">{c.students}</span>,
        },
        {
          id: 'created',
          header: 'Created',
          className: 'text-right',
          sortValue: (c) => c.createdAt,
          cell: (c) => (
            <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
          ),
        },
      ]}
    />
  )
}
