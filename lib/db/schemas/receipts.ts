import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { invoices } from './invoices'
import { users } from './users'

// invoice_id/user_id are intentionally not cascaded — a receipt is an
// immutable snapshot that must outlive the invoice or user that created it.
export const receipts = pgTable('receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  amountCents: integer('amount_cents').notNull(),
  description: text('description').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }).notNull(),
  receiptNumber: text('receipt_number').notNull().unique(),
})
