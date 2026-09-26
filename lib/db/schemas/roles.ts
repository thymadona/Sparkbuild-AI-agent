import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// platform_admin, the platform owner's org-less role. drizzle/0015 seeds it
// with this fixed id so the user_roles check constraint can name it. It
// carries no role_permissions rows: a marker for the D9 console, not a grant.
export const PLATFORM_ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000002'

// Roles: admin and teacher (granted per org, in user_roles.org_id), student
// and platform_admin. `student` is system-managed and carries zero
// role_permissions rows on purpose — an identity marker, not a grant.
// Checks go through lib/auth/permissions.ts.
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})
