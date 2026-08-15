# drizzle/ — the applied migration history

This folder is the schema of record, applied via `bun run db:migrate`.
`supabase/migrations/` no longer exists (removed 2026-08-15 in the cutover
to this workflow) — `lib/db/schema.ts` + this folder replace it entirely.

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

## Consequence of this cutover, worth knowing

Supabase's own migration tracking (`supabase_migrations.schema_migrations`)
is no longer written to going forward. That means the Supabase dashboard's
migration view, `supabase db reset`, and the Supabase MCP's
`list_migrations`/`create_branch`/`merge_branch` tools will not reflect
schema changes made after 2026-08-15 — they still see the old history up to
the cutover point and nothing past it. `drizzle.__drizzle_migrations` is the
real ledger now; query it directly if you need to check what's applied.

## `0000_messages.sql` through `0018_class_enabled_lessons.sql`

These 19 files are the actual, real history of how this schema got to its
current state — recovered from the original `supabase/migrations/*.sql`
files (17 of them straight from git history; `0013_revoke_anon_execute_role_functions.sql`
and `0016_is_enrolled_in_class_fix_teacher_exemption.sql` were applied
directly to the DB during earlier work and never had a local file, so their
SQL was recovered from `supabase_migrations.schema_migrations` instead —
same content, just a different recovery path). Renumbered sequentially and
renamed to match the DB's canonical migration names (`bun
run db:migrate` used to run them one at a time on the schema's original
timeline; each `NNNN_*.sql` here is one of those, unchanged).

None of these 19 were re-executed during the reconstruction — they were
already live in the database. Instead, each was hand-marked as applied: one
row per file was inserted directly into `drizzle.__drizzle_migrations`,
with that file's exact sha256 hash and a `created_at` derived from its
original applied timestamp (so the ordering here matches the real
chronology, not just alphabetical). Verified working: running `bun run
db:migrate` right after logged only "already exists, skipping" for the
tracking table itself, inserted zero new rows, and left every table's row
count unchanged. `bunx drizzle-kit generate` was also re-verified afterward
— it only reads the *latest* journal entry's snapshot (`meta/0018_snapshot.json`)
to diff against `schema.ts`, so having 18 earlier entries with no snapshot
file of their own (their `.sql` files are self-sufficient — the runtime
migrator only ever reads `meta/_journal.json` + each tag's `.sql` file, never
the snapshots) is expected and doesn't break anything.

Every migration after `0018_class_enabled_lessons.sql` represents a real,
intentional schema change made after the cutover, generated the normal way.
