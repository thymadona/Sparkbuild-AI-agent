import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects'

// completed_task_ids stores task ids as plain strings, which is why a lesson
// catalog is never edited in place once students have progress on it —
// bump `projects.lesson_version` and add a catalog instead.
//
// __tests__/integration/api/lesson-progress.test.ts regexes this file's text
// for the cascading FK below; keep that column on one line.
export const lessonProgress = pgTable(
  'lesson_progress',
  {
    projectId: uuid('project_id')
      .primaryKey()
      .references(() => projects.id, { onDelete: 'cascade' }),
    completedTaskIds: text('completed_task_ids').array().default([]).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('lesson_progress_updated_at_idx').on(t.updatedAt.desc())]
)
