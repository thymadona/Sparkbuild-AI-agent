import { sql } from 'drizzle-orm'
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    status: text('status').default('unpaid').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
  },
  (t) => [
    // The invoice's org is its student's org, enforced by the database.
    foreignKey({
      name: 'invoices_user_id_org_id_fk',
      columns: [t.userId, t.orgId],
      foreignColumns: [users.id, users.orgId],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    index('invoices_org_id_idx').on(t.orgId),
    check('invoices_amount_cents_check', sql`${t.amountCents} > 0`),
    check('invoices_status_check', sql`${t.status} = ANY (ARRAY['unpaid', 'paid', 'void'])`),
    index('invoices_status_idx').on(t.status),
  ]
)
