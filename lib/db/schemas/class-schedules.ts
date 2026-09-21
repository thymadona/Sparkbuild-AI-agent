import { sql } from 'drizzle-orm'
import { check, pgTable, smallint, text, time, uuid } from 'drizzle-orm/pg-core'
import { classes } from './classes'

export const classSchedules = pgTable(
  'class_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    startTime: time('start_time').notNull(),
    durationMin: smallint('duration_min').default(60).notNull(),
    label: text('label'),
  },
  (t) => [
    check('class_schedules_day_of_week_check', sql`${t.dayOfWeek} >= 0 AND ${t.dayOfWeek} <= 6`),
  ]
)
