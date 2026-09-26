'use client'

import { SendIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatAmount, formatDate } from '@/lib/format'

export type InvoiceListRow = {
  id: string
  studentName: string | null
  amount_cents: number
  description: string
  due_date: string
  status: 'unpaid' | 'paid' | 'void'
  sent_at: string | null
}

// Invoices as a table; a row opens /staff/finance/[id], where every action
// on it lives. Used by /staff/finance and a student's page (no student column).
export default function InvoicesTable({
  invoices,
  showStudent = true,
}: {
  invoices: InvoiceListRow[]
  showStudent?: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const overdue = (i: InvoiceListRow) => i.status === 'unpaid' && i.due_date < today

  return (
    <DataTable
      rows={invoices}
      getRowId={(i) => i.id}
      rowHref={(i) => `/staff/finance/${i.id}`}
      noun="invoices"
      emptyText="No invoices yet."
      search={{
        placeholder: showStudent ? 'Search student or description' : 'Search description',
        text: (i) => `${i.studentName ?? ''} ${i.description}`,
      }}
      filters={[
        {
          id: 'status',
          label: 'Status',
          options: [
            { value: 'all', label: 'All statuses' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'paid', label: 'Paid' },
            { value: 'void', label: 'Void' },
          ],
          match: (i, v) => (v === 'overdue' ? overdue(i) : i.status === v),
        },
        {
          id: 'sent',
          label: 'Telegram',
          options: [
            { value: 'all', label: 'All' },
            { value: 'sent', label: 'Sent' },
            { value: 'unsent', label: 'Not sent' },
          ],
          match: (i, v) => (v === 'sent') === !!i.sent_at,
        },
      ]}
      columns={[
        ...(showStudent
          ? [
              {
                id: 'student',
                header: 'Student',
                sortValue: (i: InvoiceListRow) => (i.studentName ?? '').toLowerCase(),
                cell: (i: InvoiceListRow) =>
                  i.studentName ? (
                    <span className="font-medium text-foreground">{i.studentName}</span>
                  ) : (
                    <span className="italic text-muted-foreground/70">Unknown</span>
                  ),
              },
            ]
          : []),
        {
          id: 'description',
          header: 'Description',
          cell: (i) => (
            <span className="block max-w-xs truncate text-muted-foreground">{i.description}</span>
          ),
        },
        {
          id: 'amount',
          header: 'Amount',
          className: 'text-right',
          sortValue: (i) => i.amount_cents,
          cell: (i) => (
            <span className="font-semibold tabular-nums text-foreground">
              {formatAmount(i.amount_cents)}
            </span>
          ),
        },
        {
          id: 'due',
          header: 'Due',
          className: 'text-right',
          sortValue: (i) => i.due_date,
          cell: (i) => (
            <span
              className={`text-xs ${overdue(i) ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
            >
              {formatDate(i.due_date)}
            </span>
          ),
        },
        {
          id: 'status',
          header: 'Status',
          sortValue: (i) => i.status,
          cell: (i) => <StatusBadge status={overdue(i) ? 'overdue' : i.status} />,
        },
        {
          id: 'sent',
          header: 'Sent',
          cell: (i) =>
            i.sent_at ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                title={new Date(i.sent_at).toLocaleString()}
              >
                <SendIcon className="h-3 w-3" />
                {formatDate(i.sent_at)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/70">—</span>
            ),
        },
      ]}
    />
  )
}
