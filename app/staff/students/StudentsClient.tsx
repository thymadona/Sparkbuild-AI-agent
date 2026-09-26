'use client'

import DataTable from '@/components/dashboard/DataTable'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { Class } from '@/types'

type StudentRow = {
  id: string
  email: string
  name: string
  isActive: boolean
  hasProfile: boolean
  parentEmail: string
  parentTelegramChatId: string
  notes: string
  classes: string[]
  payment: { paid: number; unpaid: number } | null
  createdAt: string
}

function initials(name: string, email: string) {
  const parts = (name || email).split(/[\s@.]+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

// The org's students. Editing, invoicing, class moves and deactivation live
// on each student's page; a row opens it.
export default function StudentsClient({
  rows,
  classes,
}: {
  rows: StudentRow[]
  classes: Class[]
}) {
  return (
    <DataTable
      rows={rows}
      getRowId={(r) => r.id}
      rowHref={(r) => `/staff/students/${r.id}`}
      noun="students"
      emptyText="No students yet."
      search={{ placeholder: 'Search name or email', text: (r) => `${r.name} ${r.email}` }}
      filters={[
        {
          id: 'status',
          label: 'Status',
          options: [
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
          match: (r, v) => (v === 'active') === r.isActive,
        },
        {
          id: 'payment',
          label: 'Payment',
          options: [
            { value: 'all', label: 'All' },
            { value: 'unpaid', label: 'Has unpaid' },
            { value: 'paid', label: 'Paid up' },
            { value: 'none', label: 'No invoices' },
          ],
          match: (r, v) =>
            v === 'unpaid'
              ? !!r.payment && r.payment.unpaid > 0
              : v === 'paid'
                ? !!r.payment && r.payment.unpaid === 0 && r.payment.paid > 0
                : !r.payment,
        },
        {
          id: 'class',
          label: 'Class',
          options: [
            { value: 'all', label: 'All classes' },
            { value: '', label: 'No class' },
            ...classes.map((c) => ({ value: c.name, label: c.name })),
          ],
          match: (r, v) => (v === '' ? r.classes.length === 0 : r.classes.includes(v)),
        },
      ]}
      columns={[
        {
          id: 'name',
          header: 'Student',
          sortValue: (r) => (r.name || r.email).toLowerCase(),
          cell: (r) => (
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(r.name, r.email)}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-foreground">
                  {r.name || <span className="italic text-muted-foreground/70">No name</span>}
                </div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </div>
            </div>
          ),
        },
        {
          id: 'classes',
          header: 'Class',
          cell: (r) =>
            r.classes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {r.classes.map((c) => (
                  <Badge key={c} variant="secondary">
                    {c}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/70">—</span>
            ),
        },
        {
          id: 'payment',
          header: 'Payment',
          sortValue: (r) => r.payment?.unpaid ?? -1,
          cell: (r) =>
            r.payment ? (
              <div className="flex gap-1.5">
                {r.payment.unpaid > 0 && (
                  <Badge variant="destructive">{r.payment.unpaid} unpaid</Badge>
                )}
                {r.payment.paid > 0 && <Badge variant="success">{r.payment.paid} paid</Badge>}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/70">—</span>
            ),
        },
        {
          id: 'status',
          header: 'Status',
          sortValue: (r) => (r.isActive ? 0 : 1),
          cell: (r) =>
            r.hasProfile ? (
              <StatusBadge status={r.isActive ? 'active' : 'inactive'} />
            ) : (
              <span className="text-xs text-muted-foreground/70">—</span>
            ),
        },
        {
          id: 'joined',
          header: 'Joined',
          className: 'text-right',
          sortValue: (r) => r.createdAt,
          cell: (r) => (
            <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
          ),
        },
      ]}
    />
  )
}
