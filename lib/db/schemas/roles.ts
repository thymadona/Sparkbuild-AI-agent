import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Platform roles (admin, teacher, student). `student` is system-managed and
// carries zero role_permissions rows on purpose — an identity marker, not a
// grant. Checks go through lib/auth/permissions.ts.
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})
