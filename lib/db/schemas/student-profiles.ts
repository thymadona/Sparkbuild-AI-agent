import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

// Created on every sign-in by ensureStudentDefaults() (lib/auth/
// student-defaults.ts). The route guard treats a missing row as "not a
// student" and lets it through; only an explicit is_active = false redirects.
export const studentProfiles = pgTable(
  'student_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: text('full_name').default('').notNull(),
    parentEmail: text('parent_email'),
    parentTelegramChatId: text('parent_telegram_chat_id'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('student_profiles_is_active_idx').on(t.isActive)]
)
