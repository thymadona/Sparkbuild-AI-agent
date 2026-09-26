'use client'

import DataTable from '@/components/dashboard/DataTable'
import RoleBadge from '@/components/dashboard/RoleBadge'
import { formatDate } from '@/lib/format'
import { orgColumn, orgFilter } from '../org-column'
import type { OrgOption, PlatformUser } from '../platform-data'

const ROLE_ORDER = ['platform_admin', 'admin', 'teacher', 'student']

export default function AllUsersTable({
  users,
  orgs,
  initialOrg,
}: {
  users: PlatformUser[]
  orgs: OrgOption[]
  initialOrg?: string
}) {
  return (
    <DataTable
      rows={users}
      getRowId={(u) => u.id}
      rowHref={(u) => `/console/orgs/${u.orgId}`}
      noun="users"
      emptyText="No users yet."
      search={{ placeholder: 'Search name or email', text: (u) => `${u.name} ${u.email}` }}
      filters={[
        orgFilter(orgs),
        {
          id: 'role',
          label: 'Role',
          options: [
            { value: 'all', label: 'All roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'teacher', label: 'Teacher' },
            { value: 'student', label: 'Student' },
            { value: 'platform_admin', label: 'Platform owner' },
            { value: 'none', label: 'No role' },
          ],
          match: (u, v) => (v === 'none' ? u.roles.length === 0 : u.roles.includes(v)),
        },
      ]}
      initialFilters={{ org: initialOrg }}
      columns={[
        {
          id: 'user',
          header: 'User',
          sortValue: (u) => (u.name || u.email).toLowerCase(),
          cell: (u) => (
            <div>
              <div className="font-medium text-foreground">{u.name || u.email}</div>
              {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
            </div>
          ),
        },
        orgColumn(),
        {
          id: 'roles',
          header: 'Roles',
          cell: (u) =>
            u.roles.length === 0 ? (
              <span className="text-xs text-muted-foreground/70">—</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[...u.roles]
                  .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))
                  .map((r) => (
                    <RoleBadge key={r} role={r} />
                  ))}
              </div>
            ),
        },
        {
          id: 'joined',
          header: 'Joined',
          className: 'text-right',
          sortValue: (u) => u.createdAt,
          cell: (u) => (
            <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
          ),
        },
      ]}
    />
  )
}
