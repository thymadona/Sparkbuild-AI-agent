import { redirect } from 'next/navigation'
import CreateInvoiceModal from '@/components/admin/CreateInvoiceModal'
import PageHeader from '@/components/dashboard/PageHeader'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import FinanceSummary from './FinanceSummary'
import { loadFinance } from './finance-data'
import type { InvoiceListRow } from './InvoicesTable'

export default async function FinancePage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'invoices:manage'))) redirect('/staff')

  const { invoices, profileMap } = await loadFinance(user.orgId)
  const rows: InvoiceListRow[] = invoices.map((inv) => ({
    id: inv.id,
    studentName: profileMap[inv.user_id]?.full_name ?? null,
    amount_cents: inv.amount_cents,
    description: inv.description,
    due_date: inv.due_date,
    status: inv.status as InvoiceListRow['status'],
    sent_at: inv.sent_at,
  }))

  const students = Object.values(profileMap)
    .map((p) => ({ userId: p.user_id, name: p.full_name || 'No name' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Invoices, payments and receipts. Open an invoice to mark it paid or send it."
        actions={<CreateInvoiceModal students={students} />}
      />
      <FinanceSummary invoices={rows} />
    </div>
  )
}
