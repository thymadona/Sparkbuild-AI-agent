import { sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { PLATFORM_ADMIN_ROLE_ID, roles } from './roles'
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
    // The org the grant applies in: always the user's own org. NULL if and
    // only if the role is platform_admin (user_roles_org_id_check); a NULL
    // skips the composite FK. Permission checks match only grants in the
    // user's own org, so a NULL grant never grants anything.
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
    check(
      'user_roles_org_id_check',
      sql`(${t.roleId} = ${sql.raw(`'${PLATFORM_ADMIN_ROLE_ID}'::uuid`)}) = (${t.orgId} IS NULL)`
    ),
  ]
)
