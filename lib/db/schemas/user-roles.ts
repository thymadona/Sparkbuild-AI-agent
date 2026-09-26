import { foreignKey, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { roles } from './roles'
import { users } from './users'

// user_id/granted_by are NO ACTION in the DB (unlike most user_id FKs
// elsewhere, which cascade) — mirrored as-is, not "fixed" here.
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    // The org the grant applies in: always the user's own org. NULL only for
    // an org-less platform role (D1 group 2); a NULL skips the composite FK.
    orgId: uuid('org_id').references(() => organizations.id),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    foreignKey({
      name: 'user_roles_user_id_org_id_fk',
      columns: [t.userId, t.orgId],
      foreignColumns: [users.id, users.orgId],
    }).onUpdate('cascade'),
    index('user_roles_org_id_idx').on(t.orgId),
    index('user_roles_user_id_idx').on(t.userId),
  ]
)
