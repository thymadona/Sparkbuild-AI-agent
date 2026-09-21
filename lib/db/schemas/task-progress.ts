import { jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects'

// One row per task a tutor judged finished: what the tutor saw and why it said
// yes. `lesson_progress.completed_task_ids` stays the read model (XP, gates,
// cache); this is the audit trail behind it, written in the same transaction.
export const taskProgress = pgTable(
  'task_progress',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    // The tutor's own one-line reason from task_complete.
    reason: text('reason').notNull().default(''),
    // { file: source } and { file: stdout } as judged.
    code: jsonb('code').default({}).notNull(),
    output: jsonb('output').default({}).notNull(),
    judgedBy: text('judged_by').notNull().default('tutor'),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.taskId] })]
)
