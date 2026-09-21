import { date, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

// One row per user per calendar day they did lesson work. Drives the streak;
// XP and badges are derived from lesson_progress and need no table of their own.
export const activityDays = pgTable(
  'activity_days',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })]
)
