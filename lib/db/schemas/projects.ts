import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').default('Untitled').notNull(),
    files: jsonb('files').default({}).notNull(),
    // notNull to match `Project` in types/index.ts, which declares all three
    // non-null and which every consumer relies on. They carry defaults and no
    // writer has ever left them unset, but the columns allowed NULL until the
    // Drizzle conversion made the mismatch a type error rather than an `any`.
    isPublic: boolean('is_public').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    lessonId: integer('lesson_id'),
    // Unused since the homework/review feature was removed — the column, its
    // check constraint, and old rows are kept as historical data, not read or
    // written by any live code path.
    submissionStatus: text('submission_status'),
    lessonVersion: integer('lesson_version'),
    // Tutor board state (lib/board/reducer.ts BoardState); null until the tutor first draws.
    board: jsonb('board'),
  },
  (t) => [
    check(
      'projects_submission_status_check',
      sql`${t.submissionStatus} = ANY (ARRAY['submitted', 'approved', 'needs_work'])`
    ),
    index('projects_user_id_idx').on(t.userId),
    // Kept alongside the unused column above rather than dropped with it.
    index('projects_submission_status_idx').on(t.submissionStatus),
    index('projects_created_at_idx').on(t.createdAt.desc()),
    index('projects_updated_at_idx').on(t.updatedAt.desc()),
  ]
)
