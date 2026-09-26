import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  invoices as invoicesTable,
  receipts as receiptsTable,
  studentProfiles,
  users,
} from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { usersInOrg } from '@/lib/orgs'

// Everything /staff/finance lists, for one org: invoices by org_id, profiles
// through their user. Receipts are read per invoice, on its page.
export async function loadFinance(orgId: string) {
  const [invoices, profiles] = await Promise.all([
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
  ])

  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]))
  return { invoices, profileMap }
}

// One invoice for /staff/finance/[id], with its student and receipt. Another
// org's invoice, or a malformed id, is null (the page answers 404).
export async function loadInvoice(orgId: string, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
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
      receipt_id: receiptsTable.id,
      email: users.email,
      full_name: studentProfiles.fullName,
      parent_telegram_chat_id: studentProfiles.parentTelegramChatId,
    })
    .from(invoicesTable)
    .innerJoin(users, eq(users.id, invoicesTable.userId))
    .leftJoin(receiptsTable, eq(receiptsTable.invoiceId, invoicesTable.id))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, invoicesTable.userId))
    .where(and(eq(invoicesTable.id, id), eq(invoicesTable.orgId, orgId)))
    .limit(1)
  return row ?? null
}
