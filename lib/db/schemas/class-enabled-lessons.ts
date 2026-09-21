import { sql } from 'drizzle-orm'
import { check, pgTable, primaryKey, smallint, timestamp, uuid } from 'drizzle-orm/pg-core'
import { classes } from './classes'
import { users } from './users'

// Presence of a row = that lesson week is OPEN for that class; absence =
// locked.
export const classEnabledLessons = pgTable(
  'class_enabled_lessons',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    lessonId: smallint('lesson_id').notNull(),
    enabledBy: uuid('enabled_by').references(() => users.id, { onDelete: 'set null' }),
    enabledAt: timestamp('enabled_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.lessonId] }),
    check('class_enabled_lessons_lesson_id_check', sql`${t.lessonId} > 0`),
  ]
)
