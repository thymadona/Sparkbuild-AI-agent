import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// --- Better Auth ---------------------------------------------------------
// `users`, `sessions`, `accounts` and `verifications` are Better Auth's own
// storage, owned by us rather than by an external auth service (they
// replaced Supabase's `auth` schema). Better Auth resolves each field by its
// *Drizzle property name*, and the camelCase names in these four files are
// exactly the names it expects — which is why lib/auth/index.ts overrides
// `modelName` only and carries no `fields` maps. Renaming a property here
// therefore breaks the adapter at runtime ("field does not exist in the
// schema") with nothing failing at compile time; these four tables are the
// only ones where the property name is load-bearing beyond TypeScript.
//
// `id` is `uuid` rather than Better Auth's default `text` so the twelve
// existing FK columns still typecheck; `advanced.database.generateId` is set
// to crypto.randomUUID() to match. Timestamps deliberately keep Drizzle's
// default `mode: 'date'` — Better Auth reads and writes real Date objects
// (it compares `expires_at` against now) — unlike the application tables,
// which are `mode: 'string'` (see the header in lib/db/schema.ts).
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
