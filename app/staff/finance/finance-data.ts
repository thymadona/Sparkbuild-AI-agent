import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  invoices as invoicesTable,
  receipts as receiptsTable,
  studentProfiles,
} from '@/lib/db/schema'
import { usersInOrg } from '@/lib/orgs'

// Everything /staff/finance lists, for one org: invoices and receipts by
// org_id, profiles through their user.
export async function loadFinance(orgId: string) {
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
      .where(eq(invoicesTable.orgId, orgId))
      .orderBy(desc(invoicesTable.createdAt)),
    db
      .select({
        user_id: studentProfiles.userId,
        full_name: studentProfiles.fullName,
        parent_telegram_chat_id: studentProfiles.parentTelegramChatId,
      })
      .from(studentProfiles)
      .where(inArray(studentProfiles.userId, usersInOrg(orgId))),
    db
      .select({ invoice_id: receiptsTable.invoiceId, id: receiptsTable.id })
      .from(receiptsTable)
      .where(eq(receiptsTable.orgId, orgId)),
  ])

  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]))
  const receiptByInvoice = Object.fromEntries(receipts.map((r) => [r.invoice_id, r.id]))

  return { invoices, profileMap, receiptByInvoice }
}
