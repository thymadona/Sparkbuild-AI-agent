import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects'

// completed_task_ids stores task ids as plain strings, so lib/py-lessons.ts
// content stays freely live-editable but a shipped task id or `# TASK: <id>`
// anchor must never be renamed or removed without a lib/lessons.ts
// TASK_ID_ALIASES entry — see the comment above TASK_ID_ALIASES there.
//
// __tests__/integration/api/lesson-progress.test.ts regexes this file's text
// for the cascading FK below; keep that chain's call order and options as-is.
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
