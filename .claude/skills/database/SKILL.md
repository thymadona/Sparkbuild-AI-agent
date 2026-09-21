---
name: database
description: How this repo reads and writes Postgres — the single Drizzle `db` client over node-postgres (`lib/db/client.ts`), the ownership-predicate rule, `isUuid()`, `rowsOf()`, `db.execute` patterns, camelCase/snake_case naming, RLS-with-zero-policies, and the schema-change workflow (`lib/db/schemas/*.ts` → `bun run db:generate` → `bun run db:migrate`). Use for anything mentioning database, db, query, select/insert/update/delete, drizzle, drizzle-kit, postgres, migration, schema, table, column, index, foreign key, RLS, pool, transaction, seed, `db:generate`, `db:migrate`, `types/index.ts`, or "where is X stored". Read `schema-changes.md` here before adding a table/column and `tables.md` for column-level detail. Use this before exploring `lib/db/`, `drizzle/` or route handlers for query patterns — it already maps them.
---

# Database: Drizzle over node-postgres

One data path: `lib/db/client.ts` exports `db`. No Supabase client, no PostgREST, no
`@supabase/*` dependency (the DB may still be _hosted_ on Supabase; nothing in the app knows).
Schema authoring is `lib/db/schemas/*.ts`; schema of record is `drizzle/` — see
[schema-changes.md](schema-changes.md). Column-level facts for all 21 tables:
[tables.md](tables.md).

## Files

| Path                                           | What it is                                                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/db/client.ts`                             | Builds the `pg.Pool`, exports `db` (drizzle + `schema`) and `rowsOf<T>(result)`.                                                                                |
| `lib/db/schema.ts`                             | Barrel: `export *` from every file in `schemas/`. A new table **must** be added here or drizzle-kit never sees it.                                              |
| `lib/db/schemas/<table>.ts`                    | One table per file. Better Auth tables (`users`, `sessions`, `accounts`, `verifications`) use timestamp `mode: 'date'`; all 18 app tables use `mode: 'string'`. |
| `lib/db/uuid.ts`                               | `isUuid(value): value is string` — regex guard, call before any id reaches a query.                                                                             |
| `drizzle.config.ts` / `drizzle.test.config.ts` | Same config; the test one points at `TEST_DATABASE_URL`. `push`/`pull` banned (see header).                                                                     |
| `drizzle/`                                     | Migrations `0000_baseline` … `0010_bouncy_stardust` (`task_progress`), `meta/` snapshots, `_archive/` (pre-cutover history, not runnable), `README.md`.         |
| `scripts/seed-superadmin.ts`                   | `bun run db:seed:admin` — creates a credential-less admin `users` row + `user_roles` from `SUPERADMIN_EMAIL`.                                                   |
| `types/index.ts`                               | Hand-maintained TS mirror of row shapes (snake_case). Nothing generates it — update by hand with every schema change.                                           |

## `lib/db/client.ts` — what it does and why

1. Picks `TEST_DATABASE_URL` under `NODE_ENV=test`, else `DATABASE_URL`; throws at import if unset.
2. **Refuses to start** if the test URL equals `DATABASE_URL` (the harness truncates every table).
3. Registers timestamp parsers: OID 1184/1114 → ISO string with `Z`, 1082 (date) → raw `YYYY-MM-DD`.
   Then re-asserts them per query (`withOurParsers` wraps `pool.query`) because
   drizzle-orm/node-postgres overrides `types.getTypeParser` on each query.
4. `pg.Pool({ max: prod ? 5 : 1, idleTimeoutMillis: 20s, connectionTimeoutMillis: 10s, statement_timeout: 15s, idle_in_transaction_session_timeout: 15s })`, singleton on `globalThis.__pg`, `pool.on('error')` logs instead of crashing.
5. `rowsOf<T>(result)` → `result` if array, else `result.rows`, else `[]`. Every caller feeds a
   fail-closed check, so a wrong shape denies rather than throws.

**Why node-postgres, not postgres.js:** postgres.js lost queries on reused pooled connections
against Supabase's pooler — they never settled (measured: 8 concurrent × 3 rounds, 6 dropped,
node-postgres 0). Invisible locally (0.1ms round trips), hung every `/staff` page in prod.

## Query patterns (copy these)

```ts
// Ownership-scoped read — app/api/projects/[id]/submit/route.ts
db.select({ ... }).from(projects)
  .where(and(eq(projects.id, id), eq(projects.userId, user.id))).limit(1)

// Insert with returning — app/api/projects/route.ts POST
const [project] = await db.insert(projects).values(insertData).returning(projectColumns)

// Update with ownership in the WHERE — app/api/projects/route.ts PATCH
const [row] = await db.update(projects).set(updates)
  .where(and(eq(projects.id, id), eq(projects.userId, user.id))).returning(projectColumns)
if (!row) return 404

// Raw SQL — app/api/admin/invoices/[id]/pay/route.ts (inside db.transaction)
rowsOf<{ value: string }>(await tx.execute(sql`select nextval('receipt_number_seq') as value`))

// Many counts in ONE round trip — app/staff/overview-stats.ts
db.execute(sql`select (select count(*) from ...)::int as a, (select ...)::int as b, ...`)
```

`select({ ... })` objects keep **snake_case keys** (`select({ lesson_id: projects.lessonId })`)
so JSON responses, `types/index.ts` and client components share one shape. Property names on
the schema objects are camelCase with explicit column strings (`userId: uuid('user_id')`).

## Invariants

- **`db` connects as the owner and bypasses RLS.** Authorization is written into every query:
  the second `eq(table.userId, user.id)` clause or an `hasPermission()` check above it. Dropping
  it is a horizontal privilege escalation. Prefer a `where` predicate over fetch-then-compare.
- **Guard ids with `isUuid()` first.** Postgres raises `22P02` on a malformed uuid bind, Drizzle
  throws, Next renders 500. `isUuid` turns a mistyped URL into a 404.
- **Errors throw; they do not arrive as `{ error }`.** A handler that must answer 500 needs
  `try/catch`. Preserve each caller's fail mode: `lib/auth/permissions.ts` fails closed,
  `lib/ratelimit.ts` and `lib/cache.ts` fail open.
- **Never import `db` in a `'use client'` file.** All reads/writes go through route handlers and
  Server Components.
- **Count in Postgres.** Never `select` a whole table to `.length` it. Several queries on one
  page → `Promise.all` at minimum, one `SELECT` of scalar subqueries preferably. Local DB hides
  latency; test a multi-query page with `DATABASE_URL="<prod url>" bun run dev` before trusting it.
- **Some FKs are NO ACTION on purpose** — `prompts.project_id`, `receipts.invoice_id`,
  `receipts.user_id`, `user_roles.user_id`. Deleting a parent means deleting those children
  yourself first (`app/api/projects/route.ts` DELETE removes `messages`, `prompts`, then the project).
- **RLS is enabled on every table with zero policies, and that is the design**
  (`drizzle/0002_postgrest_lockdown.sql`). The owner bypasses it, so the app is unaffected; it
  closes the hole a Supabase-hosted project's PostgREST + anon key would otherwise leave
  (`sessions.token` readable = session forgery, `user_roles` writable = privilege escalation).
  A new table needs its own `enable row level security` line — `db:generate` won't write one.
- **Never adopt drizzle-kit `casing: 'snake_case'`** and drop the explicit column strings: DDL
  would then derive from property names and every rename becomes a silent schema change.
  Renaming a property today is DDL-neutral (`bun run db:generate` reports "No schema changes").
- **Renaming a property on the 4 Better Auth tables breaks sign-in at runtime** with nothing
  failing at compile time — Better Auth resolves fields by Drizzle property name (see `auth-flow`).

## Tests

Tests run against a **real** Postgres (`TEST_DATABASE_URL`, database `spark_build_test`):
`jest.globalSetup.ts` runs `bun run db:migrate:test`, `__tests__/helpers/db.ts` truncates
between tests and exposes fixtures `makeUser`, `grantRole`, `makeClass`, `addClassMember`.
`maxWorkers: 1` because every suite shares that one database. Each database keeps its own
`drizzle.__drizzle_migrations` ledger. Harness details: `project-architecture` skill.

## Gotchas / stale comments in the repo

- `drizzle/README.md` and the headers of `0001`/`0002` still say PostgREST / `supabaseAdmin`
  are live and "~41 files read through `lib/supabase-server.ts`". That file does not exist;
  the cutover is complete. Trust this skill and `CLAUDE.md`, not those headers.
- `lib/redis.ts` comment says it "mirrors the postgres.js singleton" — the client is node-postgres.
- `drizzle.config.ts` says the archive is "pre-Supabase-cutover"; it is the pre-_Drizzle_ (still
  Supabase-era) history.
- `lib/db/schemas/users.ts` refers to "the header in lib/db/schema.ts" for the `mode: 'string'`
  explanation; `schema.ts` has no header. The explanation is in `tables.md` here.
