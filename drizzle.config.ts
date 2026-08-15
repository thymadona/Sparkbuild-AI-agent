import { defineConfig } from 'drizzle-kit'

// Drizzle-native since 2026-08-15: `./drizzle` (applied via `bun run
// db:migrate`) is the schema of record — `supabase/migrations/` no longer
// exists. Workflow for any schema change: edit lib/db/schema.ts first, run
// `bun run db:generate` to derive DDL into `./drizzle`, hand-add whatever
// the DSL can't express (RLS policies, grants, security-definer functions,
// data backfills — drizzle-kit generate --custom for those), then
// `bun run db:migrate` to apply. See drizzle/README.md and
// .claude/skills/db-schema-design/SKILL.md.
//
// `push` and `pull` are permanently off limits against this config — both
// introspect the live DB, which hangs/crashes on this schema due to an
// upstream bug that misclassifies foreign keys as check constraints
// (https://github.com/drizzle-team/drizzle-orm/issues/4496, confirmed still
// reproducing on drizzle-kit 0.31.10 as of 2026-08-15 — `pull` hangs
// indefinitely fetching foreign keys, and `push --init`'s baselining also
// introspects first so it hits the same hang). `generate` doesn't
// introspect — it only diffs lib/db/schema.ts against the snapshot in
// `./drizzle` — so it's unaffected and is the only way schema changes get
// authored here.
//
// `0000_messages.sql` through `0018_class_enabled_lessons.sql` in `./drizzle`
// are the real pre-cutover history, recovered from the original
// supabase/migrations/*.sql files — see drizzle/README.md for the recovery
// mechanics. None of the 19 were re-run during the cutover (they were
// already live in the DB): each was hand-marked as applied instead, a row
// inserted directly into `drizzle.__drizzle_migrations` with its sha256
// hash and a `created_at` matching its real original applied timestamp.
// Confirmed working: `bun run db:migrate` recognizes all 19 as applied and
// skips their SQL. Every migration after 0018 is a real, intentional change
// made after the cutover.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
