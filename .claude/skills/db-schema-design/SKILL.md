---
name: db-schema-design
description: Guides schema changes to this repo's Supabase Postgres database — adding a new table, adding columns, or reshaping how a feature stores data. Enforces this repo's actual conventions (not Prisma's): (1) `supabase/migrations/*.sql` is the schema of record — a hand-authored, dated SQL file, never `drizzle-kit generate`/`push` (that would create a second, competing migration history) and never a hand-edit of an already-applied file; (2) both mirrors — `types/index.ts` and, for tables touched by server code, `lib/db/schema.ts` (Drizzle) — get updated by hand afterward, since `drizzle-kit pull` is currently broken on this schema; (3) new tables are designed for scale and RLS from the start, matching the catch-up hardening already done in `20260806_add_hot_path_indexes.sql` and `20260806130000_enable_rls_messages_projects_prompts.sql`. Use this whenever the user wants to add a table, column, or new kind of data to the database, touch `supabase/migrations/`, extend `lib/db/schema.ts`, or asks about database/schema design in this repo — even if they don't say "migration" by name.
---

# DB schema design (Supabase Postgres + Drizzle)

`supabase/migrations/*.sql` is the single source of truth for this repo's data
model — there is no ORM-managed migration history. Two hand-maintained mirrors
sit downstream of it and drift if you forget them: `types/index.ts` (used
throughout the app) and `lib/db/schema.ts` (Drizzle, for typed queries in new
server-side code — see `AGENTS.md`/`CLAUDE.md`, it's additive, not a
replacement for `supabaseAdmin` call sites). `20260806_add_hot_path_indexes.sql`
and `20260806130000_enable_rls_messages_projects_prompts.sql` both exist
because earlier tables shipped without indexes and without RLS — this skill
exists so the next table doesn't repeat those gaps.

## Before designing anything

Read `.agents/summary/data_models.md` and the migrations nearest to what
you're adding rather than guessing at conventions — id strategy, naming,
cascade behavior, check-constraint-vs-enum choices, and RLS policy shape
should match what's already there. The patterns below are what you'll find.

## 1. The migration is hand-written SQL, not a Drizzle-generated one

`drizzle.config.ts` says explicitly: don't run `drizzle-kit generate` or
`push` against this config — it would create a second migration history that
competes with `supabase/migrations/`. This schema is database-first:

1. Write the SQL yourself in a new dated file: `supabase/migrations/YYYYMMDD_short_description.sql`
   (use `YYYYMMDDHHMMSS_description.sql` if another migration already landed
   that day, matching `20260806120000_prompts_ratelimit_index.sql` /
   `20260806130000_enable_rls_messages_projects_prompts.sql`).
2. Apply it to the target Supabase project (the Supabase MCP tools'
   `apply_migration`, the Supabase CLI, or the dashboard SQL editor —
   whichever this environment has wired up; ask the user if unclear which
   project/branch to target).
3. Update `types/index.ts` by hand to match — nothing generates it.
4. If the table is (or will be) queried through `lib/db/schema.ts`, hand-edit
   that file to match too. **Do not run `bun run db:pull` to do this** — it's
   currently broken on this schema (`lib/db/schema.ts`'s own header comment
   documents why: an upstream drizzle-kit bug, #4496, misclassifies foreign
   keys as check constraints during introspection). Follow the naming/typing
   pattern already in the file (camelCase JS keys via `pgTable`'s column
   helpers, `references(() => otherTable.id)` for FKs, `check(...)` for
   Postgres check constraints, composite `primaryKey([...])` for join/child
   tables).
5. Update the route handlers that read/write the new column — remember
   `supabaseAdmin` bypasses RLS, so any new access rule must be written into
   the query itself (`.eq('user_id', user.id)`) or an explicit check, not
   left to policies.
6. Add or extend tests under `__tests__/integration/api/`.

Never hand-edit a migration file that's already been applied — if it turns
out wrong, fix forward with a new dated migration, the same way
`20260329_cascade_user_deletes.sql` and `20260403_teacher_feedback.sql`
followed up on earlier tables instead of rewriting their original migration.

## 2. jsonb is allowed here — this isn't the Prisma repo

Unlike some codebases, this schema doesn't ban jsonb: `projects.files`
(a flat filename→contents map with no fixed shape) and `app_settings.value`
both use it deliberately, and there's no history here of migrations ripping
jsonb out. Default to real columns for anything with a fixed, queryable
shape — status-like fields use `text` + a `check (... = ANY (ARRAY[...]))`
constraint instead of an enum type or a json blob (see `projects.submission_status`,
`invoices.status`, `messages.role`) — but reach for jsonb without hesitation
when the data is genuinely schema-less and not filtered on inside Postgres,
matching `files`/`value` above.

## 3. Design for scale and RLS at creation time, not as a follow-up migration

Both of the hardening migrations referenced above landed *after* the gap was
already live. Do it right the first time:

- **Index every foreign key column** the same way
  `20260806_add_hot_path_indexes.sql` retrofitted `projects.user_id` and
  `class_members.user_id` — an unindexed FK is fine until the table has rows,
  then every join and every `.eq('user_id', ...)` filter is a full scan.
- **Index columns a list/GET endpoint filters or sorts by**, not just FKs.
- **Pick the right delete behavior**: `on delete cascade` for rows that only
  exist as part of their parent (matching `projects.user_id`, `prompts.user_id`,
  `student_profiles`, `user_build_mode`, `class_members`, `messages`, and
  `invoices`, all cascading from `auth.users` per
  `20260329_cascade_user_deletes.sql`); no cascade for records that must
  outlive the thing that created them (`receipts.invoice_id` and
  `receipts.user_id` are intentionally not cascaded — a receipt is an
  immutable snapshot, not a live reference).
- **Enable Row Level Security on every new table, in the same migration**:
  `alter table "table_name" enable row level security;`. Supabase exposes
  every public-schema table over PostgREST by default; a table without RLS
  gets flagged by Supabase's security advisor as publicly readable/writable,
  even though this app's own server code goes through `supabaseAdmin`
  (service role, bypasses RLS) or the cookie-scoped client and is unaffected.
  Write real ownership policies where a client actually needs one (e.g.
  `using (auth.uid() = user_id)`, matching `messages`/`projects`/`prompts` in
  `20260806130000_enable_rls_messages_projects_prompts.sql`), not just the
  unconditional `using (true)` "admin full access" policies used on
  admin-only tables — per `.agents/summary/data_models.md`, those `true`
  policies are not a security boundary by themselves, enforcement there comes
  from server routes checking `ADMIN_EMAILS`.
- Prefer `uuid('id').defaultRandom().primaryKey()` / SQL
  `uuid primary key default gen_random_uuid()` unless the table is a join
  table or a child whose identity is only meaningful within its parent
  (composite key, e.g. `class_members (class_id, user_id)`).
