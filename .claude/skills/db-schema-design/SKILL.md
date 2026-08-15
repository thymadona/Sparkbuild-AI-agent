---
name: db-schema-design
description: Guides schema changes to this repo's Supabase Postgres database — adding a new table, adding columns, or reshaping how a feature stores data. Enforces this repo's actual conventions (not Prisma's): (1) `lib/db/schema.ts` (Drizzle) is the authoring entry point and `./drizzle` (applied via `bun run db:migrate`) is the schema of record — `supabase/migrations/` no longer exists (cut over 2026-08-15); (2) workflow is edit `schema.ts` → `bun run db:generate` (safe — diffs a local snapshot, never introspects the DB) → hand-add whatever the DSL can't express (RLS, grants, functions, backfills) via `drizzle-kit generate --custom` → `bun run db:migrate` to apply; `types/index.ts` is a separate hand-maintained mirror with no generation path, update it every time; `drizzle-kit push`/`pull` are permanently off-limits (upstream bug, see drizzle.config.ts); (3) new tables are designed for scale and RLS from the start, matching the catch-up hardening this schema already needed once. Use this whenever the user wants to add a table, column, or new kind of data to the database, touch `drizzle/` or `lib/db/schema.ts`, or asks about database/schema design in this repo — even if they don't say "migration" by name.
---

# DB schema design (Supabase Postgres + Drizzle)

`lib/db/schema.ts` is the authoring entry point and `./drizzle` (applied via
`bun run db:migrate`) is the schema of record for this repo's data model —
`supabase/migrations/` was removed in the 2026-08-15 cutover to a
Drizzle-native workflow (see `drizzle.config.ts`'s header and
`drizzle/README.md` for the full history and mechanics, including how the
pre-cutover history — `0000_messages.sql` through
`0018_class_enabled_lessons.sql` — was reconstructed from the original files
and hand-marked as applied rather than re-run).
`types/index.ts` is a second hand-maintained mirror with no generation path
at all — update it by hand every time, it drifts if you forget. Two past
migrations (retrofitting indexes and RLS onto tables that shipped without
them) are why section 3 below exists — do it right the first time instead of
needing a catch-up migration later.

## Before designing anything

Read `.agents/summary/data_models.md` and recent files in `./drizzle` rather
than guessing at conventions — id strategy, naming, cascade behavior,
check-constraint-vs-enum choices, and RLS policy shape should match what's
already there. The patterns below are what you'll find.

## 1. Author in `lib/db/schema.ts`, generate, apply — nothing is hand-written SQL by default

`drizzle-kit push` and `pull` are permanently off limits against this
config, not just discouraged: both introspect the live DB, which
hangs/crashes on this schema (upstream bug #4496 — foreign keys get
misclassified as check constraints; `pull` hangs indefinitely fetching FKs,
and `push --init`'s baselining hits the same path). `generate` is unaffected
— it only diffs `lib/db/schema.ts` against the local snapshot in
`./drizzle`, no DB connection involved — and `migrate` applies directly
against `DATABASE_URL`:

1. Edit `lib/db/schema.ts` first — add the table/column/FK/index using the
   existing naming/typing pattern (camelCase JS keys via `pgTable`'s column
   helpers, `references(() => otherTable.id, { onDelete: ... })` for FKs —
   match the delete behavior described in section 3 below, `check(...)` for
   Postgres check constraints, `index(...)` for non-PK indexes, composite
   `primaryKey([...])` for join/child tables).
2. Run `bun run db:generate`. It writes a new `NNNN_*.sql` file into
   `./drizzle` with the DDL for what you just changed.
3. If the change needs anything Drizzle's DSL can't express — RLS policies,
   grants/revokes, security-definer functions, data backfills — add a
   hand-written migration instead: `bunx drizzle-kit generate --custom
   --name=<description>` creates an empty `NNNN_*.sql` file in `./drizzle`
   to write the SQL into yourself. This is also how a policy-only or
   function-only change with no table/column shape to model gets authored —
   skip step 1–2 and go straight to a custom migration.
4. Run `bun run db:migrate` to apply. This runs directly against
   `DATABASE_URL` — there's no separate Supabase CLI/MCP apply step anymore,
   and (per `drizzle/README.md`) Supabase's own migration dashboard/`db
   reset`/MCP branching tools no longer reflect state past the cutover.
5. Update `types/index.ts` by hand to match — nothing generates it.
6. Update the route handlers that read/write the new column — remember
   `supabaseAdmin` bypasses RLS, so any new access rule must be written into
   the query itself (`.eq('user_id', user.id)`) or an explicit check, not
   left to policies.
7. Add or extend tests under `__tests__/integration/api/`.

Never hand-edit a `./drizzle` migration file that's already been applied
(check `select hash, created_at from drizzle.__drizzle_migrations order by
id` if unsure) — if it turns out wrong, fix forward with a new migration.

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

Both hardening changes referenced above (hot-path indexes, RLS on
`messages`/`projects`/`prompts`) landed *after* the gap was already live,
back when this was a hand-written-SQL schema. Do it right the first time:

- **Index every foreign key column** — an unindexed FK is fine until the
  table has rows, then every join and every `.eq('user_id', ...)` filter is
  a full scan. In `lib/db/schema.ts` this is `index('table_col_idx').on(t.col)`
  in the table's third `pgTable` argument (see `projects`, `messages`,
  `prompts`, `class_members`, `role_permissions`, `user_roles` for the
  existing pattern).
- **Index columns a list/GET endpoint filters or sorts by**, not just FKs.
- **Pick the right delete behavior**: `references(() => x.id, { onDelete:
  'cascade' })` for rows that only exist as part of their parent (matching
  `projects.userId`, `prompts.userId`, `studentProfiles.userId`,
  `userBuildMode.userId`, `classMembers`, `messages`, and `invoices`, all
  cascading from `auth.users`); no `onDelete` (defaults to `no action`) for
  records that must outlive the thing that created them (`receipts.invoiceId`
  and `receipts.userId` are intentionally not cascaded — a receipt is an
  immutable snapshot, not a live reference).
- **Enable Row Level Security on every new table, in the same migration**:
  since `pgTable`'s DSL doesn't express `ENABLE ROW LEVEL SECURITY` or
  policies, this has to go in a custom migration (`drizzle-kit generate
  --custom`) alongside the generated `CREATE TABLE` — `alter table
  "table_name" enable row level security;`. Supabase exposes every
  public-schema table over PostgREST by default; a table without RLS gets
  flagged by Supabase's security advisor as publicly readable/writable,
  even though this app's own server code goes through `supabaseAdmin`
  (service role, bypasses RLS) or the cookie-scoped client and is unaffected.
  Write real ownership policies where a client actually needs one (e.g.
  `using (auth.uid() = user_id)`, matching `messages`/`projects`/`prompts`),
  not just the unconditional `using (true)` "admin full access" policies used
  on admin-only tables — per `.agents/summary/data_models.md`, those `true`
  policies are not a security boundary by themselves, enforcement there comes
  from server routes checking `ADMIN_EMAILS`.
- Prefer `uuid('id').defaultRandom().primaryKey()` unless the table is a
  join table or a child whose identity is only meaningful within its parent
  (composite key, e.g. `class_members (class_id, user_id)`).
