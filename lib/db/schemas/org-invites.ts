import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

// An offer for an existing account to join an org. Only a user who already
// belongs to another org (SparkBuild Direct) gets one: a brand-new email is
// pre-provisioned straight into the org instead (lib/org-people.ts), because
// there is no account yet to take. The invite is bound to `email`, and only a
// signed-in user with that email may accept it (D2a group 4), so an org can't
// take an account just by typing its address.
export const orgInvites = pgTable(
  'org_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    // Stored trimmed and lowercased, like users.email from the staff routes.
    email: text('email').notNull(),
    role: text('role').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    status: text('status').default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    index('org_invites_org_id_idx').on(t.orgId),
    index('org_invites_email_idx').on(t.email),
    // One open invite per email per org; answered ones are kept as history.
    uniqueIndex('org_invites_pending_key')
      .on(t.orgId, t.email)
      .where(sql`${t.status} = 'pending'`),
    check('org_invites_role_check', sql`${t.role} = ANY (ARRAY['admin', 'teacher', 'student'])`),
    check(
      'org_invites_status_check',
      sql`${t.status} = ANY (ARRAY['pending', 'accepted', 'declined', 'revoked'])`
    ),
  ]
)
