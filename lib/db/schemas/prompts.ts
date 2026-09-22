import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'

// The permanent log of every prompt (admin views read it); the rate limit no
// longer does — that lives in Redis (lib/ratelimit.ts).
export const prompts = pgTable(
  'prompts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id),
    content: text('content').notNull(),
    // Snapshot of the turn's assembled grounding context (mode, the exact
    // system/user prompt sent, escalation tier, history) — nothing else
    // persists this per-turn, and projects.files/lesson_progress are
    // overwritten in place, so this is the only way to replay a past turn
    // for eval/regression fixtures. Nullable: rows written before this
    // column existed have none.
    context: jsonb('context'),
    // notNull for the same reason as projects: the prompt log is ordered by
    // this column, and a NULL would sort unpredictably.
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('prompts_user_id_created_at_idx').on(t.userId, t.createdAt),
    // The composite above leads on user_id, so it cannot serve the /staff
    // overview's "prompts in the last 24h", which filters on created_at alone.
    index('prompts_created_at_idx').on(t.createdAt.desc()),
  ]
)
