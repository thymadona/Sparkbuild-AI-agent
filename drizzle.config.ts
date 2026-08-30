import { defineConfig } from 'drizzle-kit'

// `./drizzle` (applied via `bun run db:migrate`) is the schema of record and
// `lib/db/schema.ts` is where it is authored. Workflow for any schema
// change: edit lib/db/schema.ts first, run `bun run db:generate` to derive
// DDL into `./drizzle`, hand-add whatever the DSL can't express (grants,
// security-definer functions, data backfills — `drizzle-kit generate
// --custom` for those), then `bun run db:migrate` to apply. See
// drizzle/README.md and .claude/skills/db-schema-design/SKILL.md.
//
// `push` and `pull` are permanently off limits against this config — both
// introspect the live DB, which hangs/crashes on this schema due to an
// upstream bug that misclassifies foreign keys as check constraints
// (https://github.com/drizzle-team/drizzle-orm/issues/4496, confirmed still
// reproducing on drizzle-kit 0.31.10 — `pull` hangs indefinitely fetching
// foreign keys, and `push --init`'s baselining also introspects first so it
// hits the same hang). `generate` doesn't introspect — it only diffs
// lib/db/schema.ts against the snapshot in `./drizzle` — so it's unaffected
// and is the only way schema changes get authored here.
//
// History starts at `0000_baseline.sql`. The nineteen pre-Supabase-cutover
// files are archived under `drizzle/_archive/` and are not runnable — they
// reference `auth.users`, `auth.uid()`, and the `authenticated`/`anon`
// roles, none of which exist outside Supabase. drizzle/README.md explains
// the squash and what was deliberately dropped with it.

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Each database carries its own ledger — `drizzle.__drizzle_migrations`
  // lives *inside* the target database, so dev and test track what they have
  // applied independently even though both replay the same ./drizzle folder.
  // Stated explicitly (rather than left to the default) so the separation is
  // visible at a glance and can't drift if a default ever changes.
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
})
