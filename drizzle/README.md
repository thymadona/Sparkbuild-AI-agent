# drizzle/ — the applied migration history

This folder is the schema of record, applied via `bun run db:migrate`
against `DATABASE_URL`. `lib/db/schema.ts` is the authoring entry point;
nothing else defines the schema.

## Workflow for a schema change

1. Edit `lib/db/schema.ts` first — add/change the table, columns, FKs,
   indexes, whatever the change is.
2. Run `bun run db:generate`. It diffs `schema.ts` against the snapshot in
   `drizzle/meta/` and writes a new `NNNN_*.sql` file here with the DDL.
3. If the change needs anything Drizzle's DSL can't express — RLS policies,
   grants/revokes, security-definer functions, data backfills — add a
   hand-written migration with `bunx drizzle-kit generate --custom
   --name=<description>` and write the SQL yourself (see
   `.claude/skills/db-schema-design/SKILL.md`).
4. Run `bun run db:migrate` to apply it. This runs directly against
   `DATABASE_URL` — there is no separate "apply" step through Supabase
   CLI/MCP anymore.
5. Update `types/index.ts` by hand to match (still a separate hand-mirror,
   nothing generates it) and any route handlers that read/write the change.

Never hand-edit a migration file that's already been applied (i.e. has a row
in `drizzle.__drizzle_migrations` — check via
`select hash, created_at from drizzle.__drizzle_migrations order by id`). If
one turns out wrong, fix forward with a new migration instead.

## The squash to `0000_baseline.sql`

The nineteen files `0000_messages.sql` … `0018_class_enabled_lessons.sql`
now live in `_archive/`. They are kept for provenance only — **they are not
runnable and are not part of the history any more.** Two reasons they had to
go:

1. They were never actually executed. During the 2026-08-15 Supabase→Drizzle
   cutover each one was hand-marked as applied (a row inserted straight into
   `drizzle.__drizzle_migrations`) because the DDL was already live in the
   hosted database. There was no database anywhere that those files had
   built.
2. They cannot build one. They reference `auth.users`, `auth.uid()`, and the
   roles `authenticated`/`anon` — all Supabase/PostgREST constructs that do
   not exist on plain Postgres.

`0000_baseline.sql` is generated from `lib/db/schema.ts` and creates the
whole schema, including the four Better Auth tables (`users`, `sessions`,
`accounts`, `verifications`) that replaced Supabase's `auth` schema. Every
`user_id` FK that used to point at `auth.users(id)` now points at
`public.users(id)`, with the original delete rules preserved — including the
two deliberate deviations `lib/db/schema.ts` documents (`receipts` does not
cascade; `user_roles` is NO ACTION).

`0001_functions_sequence_seed.sql` carries forward everything the Drizzle
DSL can't express: the five security-definer authorization functions
(`has_permission`, `is_admin`, `is_teacher_of_class`,
`can_access_teacher_dashboard`, `is_enrolled_in_class`), the
`receipt_number_seq` sequence, and the roles/permissions seed rows. It is
re-runnable — every statement is create-or-replace or `ON CONFLICT` guarded.

### What was deliberately dropped

**The RLS policies** — the policies, not row security itself. Every policy in
the archive predicated on `auth.uid()`, which only Supabase Auth populates and
which is now always null. A policy set predicated on a null value reads as a
boundary while enforcing nothing, so none were carried forward. Authorization
lives in the route handlers and in the five functions above, and every query
carries its own ownership predicate.

**The `grant execute … to authenticated` lines.** Those roles are Supabase
constructs and the application is the owner of these functions, so it needs no
grant. The matching revokes moved to `0002` (below).

## `0002_postgrest_lockdown.sql`

Supabase is *not* gone. The hosted project stays live because ~41 files still
read and write through PostgREST (`lib/supabase-server.ts`), and Supabase's
default privileges (`alter default privileges in schema public grant all on
tables to anon, authenticated, service_role`) mean every table `0000_baseline`
creates is reachable by the anon key — a credential shipped to browsers by
design.

Left alone, that turns 21 tables into a public read/write surface:
`sessions.token` is session forgery, `user_roles` is privilege escalation. So
`0002` re-establishes a deny-by-default in two independent layers:

1. `enable row level security` on all 21 tables with **zero policies**.
   `service_role` and the table owner hold `BYPASSRLS`, so `supabaseAdmin` and
   Drizzle are unaffected; `anon` and `authenticated` are denied outright.
2. Every grant revoked from `anon`/`authenticated`, including the default
   privileges, so a future `db:migrate` cannot silently re-grant on new tables.

It is re-runnable, and the revokes are guarded on the role existing so the same
file applies cleanly to a plain Postgres — local development and the CI service
container, where `anon` and `authenticated` are not defined.

**Anything added to `lib/db/schema.ts` from now on needs a matching
`enable row level security` line** while PostgREST is still in the picture;
`bun run db:generate` will not write one for you. That obligation ends with the
last `supabaseAdmin` call site.
