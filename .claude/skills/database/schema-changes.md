# Schema changes: `lib/db/schemas/*.ts` → `drizzle/`

`lib/db/schemas/<table>.ts` (one table per file, re-exported by `lib/db/schema.ts`) is the
authoring entry point; `./drizzle` is the schema of record, applied with `bun run db:migrate`
directly against `DATABASE_URL`. `supabase/migrations/` no longer exists (cut over
2026-08-15; the 19 pre-cutover files live in `drizzle/_archive/`, are not runnable — they
reference `auth.users`, `auth.uid()`, `authenticated` — and were hand-marked applied).

## Workflow

1. Edit or create the table's file in `lib/db/schemas/`. A **new table also needs an
   `export * from './schemas/<name>'` line in `lib/db/schema.ts`**, or drizzle-kit never sees it.
   Match existing helpers: `uuid('id').defaultRandom().primaryKey()`, `references(() => other.id,
{ onDelete: ... })`, `check(...)`, `index(...)`, `primaryKey({ columns: [...] })` for join/child
   tables, timestamps `{ withTimezone: true, mode: 'string' }` on app tables.
2. `bun run db:generate` — diffs `lib/db/schema.ts` against `drizzle/meta/*_snapshot.json`
   (no DB connection; safe) and writes `drizzle/NNNN_<name>.sql`.
3. Anything the DSL can't express — `enable row level security`, grants/revokes,
   security-definer functions, data backfills — goes in a hand-written migration:
   `bunx drizzle-kit generate --custom --name=<description>` creates an empty `NNNN_*.sql`.
   A policy-only or function-only change skips steps 1–2 and starts here.
4. `bun run db:migrate` (dev) / `bun run db:migrate:test` (test DB; Jest also does this in
   `jest.globalSetup.ts`). **Deployed databases are migrated by hand; CI never does it.**
5. Update `types/index.ts` by hand — nothing generates it, it drifts if forgotten.
6. Update the route handlers that read/write the column; write the ownership/permission check
   into each query (`db` bypasses RLS — see `SKILL.md`).
7. Add/extend tests under `__tests__/integration/api/` against the real test DB.

Never hand-edit an applied migration (check `select hash, created_at from
drizzle.__drizzle_migrations order by id`); fix forward with a new one.

**`drizzle-kit push` and `pull` are permanently banned.** Both introspect the live DB and hang
or crash on this schema (drizzle-orm issue #4496: FKs misclassified as check constraints;
confirmed on drizzle-kit 0.31.10). `drizzle.config.ts`'s header says the same. If the DB is
hosted on Supabase, that project's migration dashboard / `db reset` / MCP branching no longer
reflect schema state — `drizzle/` does.

## Design rules (do it at creation time, not as a catch-up migration)

- **Index every FK column** and every column a list/GET endpoint filters or sorts by
  (`index('table_col_idx').on(t.col)` in the third `pgTable` argument). Two past migrations
  (`0005`, and the RLS lockdown) exist because tables shipped without this.
- **Pick `onDelete` deliberately.** `cascade` for rows that only exist as part of their parent
  (`projects.userId`, `messages.*`, `class_members.*`, `sessions.userId`, `invoices.userId`,
  `student_profiles.userId`, `lesson_progress.projectId`, `activity_days.userId`). No `onDelete`
  (= `no action`) for records that must outlive their creator: `receipts.invoiceId` /
  `receipts.userId` (immutable snapshot), `prompts.projectId` (permanent log),
  `user_roles.userId`. `set null` for attribution columns (`class_enabled_lessons.enabledBy`).
- **Status-like fields are `text` + a `check (... = ANY (ARRAY[...]))`**, not a Postgres enum
  (`projects.submission_status`, `invoices.status`, `messages.role`, `class_members.role`).
- **jsonb is fine for genuinely schema-less data** that Postgres never filters on:
  `projects.files` (filename → contents), `projects.board`, `prompts.context`,
  `app_settings.value`. Fixed, queryable shapes get real columns.
- **Every new table gets `alter table "<name>" enable row level security;`** in the custom
  migration next to its `CREATE TABLE` (`0007_odd_whiplash.sql` is the model). No policies —
  the app connects as owner; the line exists to close PostgREST if the DB is Supabase-hosted.
- **PK:** `uuid('id').defaultRandom().primaryKey()` unless it's a join/child table whose identity
  is only meaningful within its parent (`class_members (class_id, user_id)`,
  `activity_days (user_id, day)`, `lesson_progress.project_id`).
- **Naming:** camelCase property, explicit snake_case column string. Never `casing: 'snake_case'`.
- **Better Auth tables** (`users`, `sessions`, `accounts`, `verifications`) keep `mode: 'date'`
  and their exact camelCase property names — the library resolves fields by property name.

## Migration ledger

| File                                         | Purpose                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0000_baseline.sql`                          | Generated full schema, 21 tables incl. the since-dropped `user_build_mode`.                                                                                                                                                                                                                                                                          |
| `0001_functions_sequence_seed.sql`           | `receipt_number_seq`; seeds roles `admin`/`teacher`, 7 permission keys, `role_permissions` (admin = all via cross join; teacher = `homework:review`, `students:message`); SQL fns `has_permission`, `is_admin`, `is_teacher_of_class`, `can_access_teacher_dashboard`, `is_enrolled_in_class` (security definer, `search_path=public`). Re-runnable. |
| `0002_postgrest_lockdown.sql`                | RLS on all tables, zero policies; revokes every `anon`/`authenticated` grant + default privileges (guarded on role existence).                                                                                                                                                                                                                       |
| `0003_not_null_project_columns.sql`          | Backfill + `SET NOT NULL` on `projects.is_public/created_at/updated_at`, `prompts.created_at`.                                                                                                                                                                                                                                                       |
| `0004_student_role.sql`                      | Inserts `student` role, zero permissions.                                                                                                                                                                                                                                                                                                            |
| `0005_staff_overview_indexes.sql`            | 7 indexes for `/staff` overview counts.                                                                                                                                                                                                                                                                                                              |
| `0006_flippant_quasar.sql`                   | `prompts.context jsonb`.                                                                                                                                                                                                                                                                                                                             |
| `0007_odd_whiplash.sql`                      | `activity_days` table + FK + RLS line.                                                                                                                                                                                                                                                                                                               |
| `0008_thick_red_skull.sql`                   | `projects.board jsonb`.                                                                                                                                                                                                                                                                                                                              |
| `0009_drop_user_build_mode.sql`              | Drops `user_build_mode`; deletes `class_enabled_lessons` rows with `lesson_id < 100` (old HTML course ids).                                                                                                                                                                                                                                          |
| `0010_bouncy_stardust.sql`                   | `task_progress` table (per-completion audit row behind `recordTaskDone`) + FK + RLS line.                                                                                                                                                                                                                                                            |
| `0011_remove_homework_review_permission.sql` | Deletes the `homework:review` permission (and its `role_permissions` grants) — the homework review feature was removed; former-homework tasks are now plain `bonus` tasks.                                                                                                                                                                           |
| `0012_quick_freak.sql`                       | Widens `messages_role_check` to add `'helper'` (a Bolt exchange: the request and Bolt's code).                                                                                                                                                                                                                                                       |
