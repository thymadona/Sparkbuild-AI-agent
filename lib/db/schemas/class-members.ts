import { sql } from 'drizzle-orm'
import { check, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { classes } from './classes'
import { users } from './users'

// `role` here is per-class membership ('student' | 'teacher'), not the
// platform role in user_roles — the two never interact.
export const classMembers = pgTable(
  'class_members',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('student').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.userId] }),
    check('class_members_role_check', sql`${t.role} = ANY (ARRAY['student', 'teacher'])`),
    index('class_members_user_id_idx').on(t.userId),
    // The /staff overview counts distinct teachers school-wide, which filters
    // on role alone and so cannot use the user_id index above.
    index('class_members_role_idx').on(t.role),
  ]
)
