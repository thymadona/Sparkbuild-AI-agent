'use client'

import DataTable from '@/components/dashboard/DataTable'
import RoleBadge from '@/components/dashboard/RoleBadge'

type UserRow = { id: string; email: string; fullName: string; roles: string[] }

const ROLE_ORDER = ['admin', 'teacher', 'student', 'platform_admin']

// Everyone in the org. Roles are granted and revoked on each user's page.
export default function UsersClient({ users }: { users: UserRow[] }) {
  return (
    <DataTable
      rows={users}
      getRowId={(u) => u.id}
      rowHref={(u) => `/staff/users/${u.id}`}
      noun="users"
      emptyText="No users yet."
      search={{ placeholder: 'Search name or email', text: (u) => `${u.fullName} ${u.email}` }}
      filters={[
        {
          id: 'role',
          label: 'Role',
          options: [
            { value: 'all', label: 'All roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'teacher', label: 'Teacher' },
            { value: 'student', label: 'Student' },
            { value: 'none', label: 'No role' },
          ],
          match: (u, v) => (v === 'none' ? u.roles.length === 0 : u.roles.includes(v)),
        },
      ]}
      columns={[
        {
          id: 'user',
          header: 'User',
          sortValue: (u) => (u.fullName || u.email).toLowerCase(),
          cell: (u) => (
            <div>
              <div className="font-medium text-foreground">{u.fullName || u.email}</div>
              {u.fullName && <div className="text-xs text-muted-foreground">{u.email}</div>}
            </div>
          ),
        },
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
      ]}
    />
  )
}
