import { redirect } from 'next/navigation'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { invoices as invoicesTable, receipts as receiptsTable, studentProfiles } from '@/lib/db/schema'
import { hasPermission } from '@/lib/auth/permissions'
import FinanceClient from './FinanceClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function FinancePage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'invoices:manage'))) redirect('/staff')

  const [invoices, profiles, receipts] = await Promise.all([
    db
      .select({
        id: invoicesTable.id,
        user_id: invoicesTable.userId,
        amount_cents: invoicesTable.amountCents,
        description: invoicesTable.description,
        due_date: invoicesTable.dueDate,
        status: invoicesTable.status,
        sent_at: invoicesTable.sentAt,
        paid_at: invoicesTable.paidAt,
        created_at: invoicesTable.createdAt,
      })
      .from(invoicesTable)
      .orderBy(desc(invoicesTable.createdAt)),
    db
      .select({
        user_id: studentProfiles.userId,
        full_name: studentProfiles.fullName,
        parent_telegram_chat_id: studentProfiles.parentTelegramChatId,
      })
      .from(studentProfiles),
    db
      .select({ invoice_id: receiptsTable.invoiceId, id: receiptsTable.id })
      .from(receiptsTable),
  ])

  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]))
  const receiptByInvoice = Object.fromEntries(receipts.map((r) => [r.invoice_id, r.id]))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Finance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Invoices, payments, and receipts</p>
      </div>
      <FinanceClient
        invoices={invoices as Parameters<typeof FinanceClient>[0]['invoices']}
        profileMap={profileMap as Parameters<typeof FinanceClient>[0]['profileMap']}
        receiptByInvoice={receiptByInvoice}
      />
    </div>
  )
}
