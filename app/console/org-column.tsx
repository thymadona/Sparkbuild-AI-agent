'use client'

import Link from 'next/link'
import type { Column, TableFilter } from '@/components/dashboard/DataTable'
import type { OrgOption } from './platform-data'

// The Organization column and filter every cross-org console list shares.

export function orgColumn<T extends { orgId: string; orgName: string }>(): Column<T> {
  return {
    id: 'org',
    header: 'Organization',
    sortValue: (r) => r.orgName.toLowerCase(),
    cell: (r) => (
      <Link
        href={`/console/orgs/${r.orgId}`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {r.orgName}
      </Link>
    ),
  }
}

export function orgFilter<T extends { orgId: string }>(orgs: OrgOption[]): TableFilter<T> {
  return {
    id: 'org',
    label: 'Organization',
    options: [
      { value: 'all', label: 'All organizations' },
      ...orgs.map((o) => ({ value: o.id, label: o.name })),
    ],
    match: (r, v) => r.orgId === v,
  }
}
