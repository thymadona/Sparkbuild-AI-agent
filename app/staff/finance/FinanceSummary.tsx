import StatCard from '@/components/dashboard/StatCard'
import { formatAmount } from '@/lib/format'
import InvoicesTable, { type InvoiceListRow } from './InvoicesTable'

// Totals over the table of every invoice in the org.
export default function FinanceSummary({ invoices }: { invoices: InvoiceListRow[] }) {
  const unpaid = invoices.filter((i) => i.status === 'unpaid')
  const paid = invoices.filter((i) => i.status === 'paid')
  const sum = (rows: InvoiceListRow[]) => rows.reduce((s, i) => s + i.amount_cents, 0)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon="outstanding"
          tone="destructive"
          label="Outstanding"
          value={formatAmount(sum(unpaid))}
          hint={`${unpaid.length} unpaid invoice${unpaid.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon="collected"
          tone="success"
          label="Collected"
          value={formatAmount(sum(paid))}
          hint={`${paid.length} paid invoice${paid.length !== 1 ? 's' : ''}`}
        />
        <StatCard icon="invoices" label="Invoices" value={invoices.length} hint="all invoices" />
      </div>
      <InvoicesTable invoices={invoices} />
    </div>
  )
}
