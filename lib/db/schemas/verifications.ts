import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Better Auth table — property names are load-bearing and timestamps are
// `mode: 'date'`; see the note in ./users.ts.
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)]
)
