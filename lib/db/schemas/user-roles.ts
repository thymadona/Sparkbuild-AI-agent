import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { roles } from './roles'
import { users } from './users'

// user_id/granted_by are NO ACTION in the DB (unlike most user_id FKs
// elsewhere, which cascade) — mirrored as-is, not "fixed" here.
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id').notNull().references(() => users.id),
    roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index('user_roles_user_id_idx').on(t.userId)]
)
