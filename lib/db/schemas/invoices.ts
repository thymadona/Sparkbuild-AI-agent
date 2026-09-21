import { sql } from 'drizzle-orm'
import { check, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    status: text('status').default('unpaid').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    check('invoices_amount_cents_check', sql`${t.amountCents} > 0`),
    check('invoices_status_check', sql`${t.status} = ANY (ARRAY['unpaid', 'paid', 'void'])`),
    index('invoices_status_idx').on(t.status),
  ]
)
