import { foreignKey, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { invoices } from './invoices'
import { organizations } from './organizations'
import { users } from './users'

// invoice_id/user_id are intentionally not cascaded — a receipt is an
// immutable snapshot that must outlive the invoice or user that created it.
export const receipts = pgTable(
  'receipts',
  {
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
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
  },
  (t) => [
    // Same org as the receipt's user; no cascade, like user_id itself.
    foreignKey({
      name: 'receipts_user_id_org_id_fk',
      columns: [t.userId, t.orgId],
      foreignColumns: [users.id, users.orgId],
    }).onUpdate('cascade'),
    index('receipts_org_id_idx').on(t.orgId),
  ]
)
