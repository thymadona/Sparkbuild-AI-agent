# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## What This Project Is

Student Code Builder: an AI-assisted Python platform for students aged 10–16. Students work
through a 12-week Python course (the only catalog, version 3): weeks 1–6 teach fundamentals with
the LLM as a tutor, weeks 7–12 are projects where the student directs it. Every project is a
lesson project and opens on the tutor board (`/board/[id]`), where the LLM talks in short
captions and draws on a shared board with tools; Python runs in the browser (Pyodide). Teachers
and admins run classes, review homework, and manage invoices/receipts (delivered over Telegram)
through a back office. The original HTML/CSS/JS course, its srcdoc preview editor, free-form
projects and the public gallery were removed in September 2026 — do not reintroduce them.

## Commands

Use `bun` — the repo ships `bun.lock`. Scripts must be run as `bun run <script>`, not
`bun <script>`: bun's built-in test runner is a different tool from Jest and is not a drop-in
for `bun run test`.

```bash
bun run dev              # Start dev server (Turbopack)
bun run build            # Production build
bun run start             # Serve production build
bun run test               # Run all Jest tests
bun run lint                # ESLint (flat config)
bun run db:studio           # Open Drizzle Studio against the live DB
bun run db:migrate          # Apply drizzle/ to DATABASE_URL
bun run db:migrate:test     # Apply drizzle/ to TEST_DATABASE_URL
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/ratelimit.test.ts   # Single test file
```

**Tests run against a real Postgres**, not mocks of one: `TEST_DATABASE_URL` points at a
separate database (`spark_build_test`) that `jest.globalSetup.ts` migrates before any suite and
that `__tests__/helpers/db.ts` truncates between tests. `lib/db/client.ts` refuses to start if
`TEST_DATABASE_URL` equals `DATABASE_URL`, so a test run can't wipe development data. Each
database keeps its own `drizzle.__drizzle_migrations` ledger, so dev and test track
independently. Fixtures (`makeUser`, `grantRole`, `makeClass`, `addClassMember`) live in
`__tests__/helpers/db.ts`.

`bun run test` sets `NODE_OPTIONS=--experimental-vm-modules` because the Python-check tests load real Pyodide under Node (`__tests__/helpers/pyodide.ts`); a bare `jest` run fails those suites with "dynamic import callback" — keep the flag when running a single file.

`bun run test:unit` / `bun run test:integration` are broken (`--selectProjects` with no
`projects` defined in `jest.config.ts`) — use `bun run test` or a path filter instead.

## Architecture

Three subsystems share one Next.js 16 (App Router) + React 19 codebase:

1. **Board** (`app/board/`, `lib/board/`, `lib/tutor/`) — the student's workspace. Each
   student event hits `POST /api/projects/[id]/turn`, which runs one tutor turn (`lib/tutor/turn.ts`)
   against DeepSeek via the `openai` SDK pointed at DeepSeek's `baseURL` (`lib/deepseek.ts`)
   with tool calls that edit the board (`lib/board/tools.ts`, reduced by `lib/board/reducer.ts`).
   Code nodes are Python only and run in a Pyodide worker (`hooks/usePythonRunner.ts`,
   `public/py-worker.js`).
2. **Lessons** (`app/lessons/`, `lib/lessons.ts`, `lib/py-lessons.ts`, `lib/task-checks.ts`,
   `public/templates/`) — weekly lessons backed by starter files with in-file task anchors,
   code-aware task verification, gated homework, and a game layer (`lib/xp.ts`: XP, levels,
   badges from saved progress; streak from the `activity_days` table).
3. **Admin back office** (`app/admin/`, `app/api/admin/`, `components/admin/`) — student
   accounts, classes with weekly schedules, homework review, and invoices/receipts delivered to
   parents over Telegram.

**Colocation rule:** route-specific client components live beside their route
(`app/board/LiveBoard.tsx`, `app/admin/classes/ClassesClient.tsx`). Only genuinely
reusable UI goes in `components/`. A `page.tsx` next to a `*Client.tsx` is always a
server-fetch / client-interact pair.

**Authentication is Better Auth, not Supabase** (`lib/auth/`). `lib/auth/index.ts` configures it
over the Drizzle adapter with Google as the only social provider; `app/api/auth/[...all]/route.ts`
serves the whole surface, including the OAuth callback at `/api/auth/callback/google` — the app
talks to Google directly rather than brokering through Supabase. `lib/auth/session.ts`'s
`getSessionUser()` is the single way to read the caller in a page, layout or route handler; it
validates against the `sessions` table on every call rather than trusting the cookie. Client
components use `authClient` from `lib/auth/client.ts` for sign-in/sign-out. Better Auth owns
`users`/`sessions`/`accounts`/`verifications`; those four tables keep Drizzle's default
`mode: 'date'` timestamps because the library reads and writes real `Date` objects, unlike every
application table (`mode: 'string'`). Better Auth resolves each field by its *Drizzle property
name*, and the schema's camelCase properties match its own field names exactly — which is why
`lib/auth/index.ts` sets `modelName` only and carries no `fields` maps. Renaming a property on
those four tables therefore breaks auth at runtime with nothing failing at compile time. `account.accountLinking.trustedProviders: ['google']` is
load-bearing: admin-provisioned students get a credential-less `users` row and claim it by
signing in with Google on the matching address.

**Drizzle over one `DATABASE_URL` is the only data path.** `lib/db/client.ts` exports the single
`db` client; there is no Supabase client, no PostgREST, and no `@supabase/supabase-js`
dependency. The database may still be *hosted* by Supabase — that is a hosting choice and
nothing in the app knows about it.

It connects as the database owner and therefore **bypasses RLS**, so authorization is written
into every query: `.where(and(eq(projects.id, id), eq(projects.userId, user.id)))`. Dropping the
second clause is a horizontal privilege escalation, not a missing filter. Prefer a `where`
predicate over fetching a row and comparing its `user_id` afterwards — a predicate cannot be
forgotten further down the function.

Two consequences of Postgres being reached directly rather than through PostgREST:

- **A malformed id is an error, not an empty result.** PostgREST absorbed
  `.eq('id', 'not-a-uuid')` as `{ data: null }`; Postgres raises `22P02` and Drizzle throws it,
  which Next renders as a 500. Every handler that takes an id from the path or query string
  guards it with `isUuid()` (`lib/db/uuid.ts`) so a mistyped URL is still a 404.
- **Errors throw rather than arriving as `{ error }`.** A handler that answered 500 on a database
  error needs a `try`/`catch` to keep doing so, and one that failed open or closed needs the
  catch to preserve that choice — see `lib/auth/permissions.ts` (fails closed) against
  `lib/ratelimit.ts` (fails open).

Never import `db` into a Client Component.

**Naming: camelCase in TypeScript, snake_case in Postgres.** Every column in `lib/db/schemas/*.ts`
carries an explicit name string — `userId: uuid('user_id')` — so the two sides are decoupled and
renaming a property is DDL-neutral (`bun run db:generate` must report "No schema changes"). Do
**not** adopt drizzle-kit's `casing: 'snake_case'` option and drop those strings: with it the DDL
is derived from the property name, which turns every future rename into a silent schema change.
`select({ ... })` objects deliberately keep snake_case *keys*
(`select({ lesson_id: projects.lessonId })`) so JSON responses, `types/index.ts` and Client
Components all see one shape. This outlived PostgREST on purpose: flipping ~60 read sites,
`types/index.ts` and every client component to camelCase is its own change, not a rider on the
data-client swap. `./drizzle` (applied via `bun run db:migrate`) is the schema of record:
`./drizzle` (applied via `bun run db:migrate`) is the schema of record — `supabase/migrations/`
no longer exists. Workflow for a schema change: edit the table's file in `lib/db/schemas/` first (one
table per file; `lib/db/schema.ts` is only the barrel that re-exports them, and a **new table
needs an `export *` line there** or `db:generate` never sees it), run
`bun run db:generate` (diffs against the snapshot in `./drizzle`, safe — see below) to derive
DDL into `./drizzle`, hand-add whatever Drizzle's DSL can't express (RLS policies, grants,
security-definer functions, data backfills — `drizzle-kit generate --custom` for those), then
`bun run db:migrate` to apply it directly against `DATABASE_URL`. `drizzle-kit push` and `pull`
are permanently off limits against this schema — `drizzle.config.ts`'s header comment explains
why (an upstream drizzle-kit bug makes them hang or crash; `lib/db/schema.ts`'s header and
`drizzle/README.md` cover the rest of the workflow, including the consequence that if the
database is hosted on Supabase, that project's own migration dashboard/`db reset`/MCP branching
tools no longer reflect schema state).

**The LLM contract is tool calls on a board, not generated files.** The tutor never returns a
file; it speaks in captions and calls board tools (`board_add`, `board_edit`, `request_trace`
…) that `lib/board/reducer.ts` applies to a zod-validated `BoardState` (`lib/board/schema.ts`,
where `Lang` is `python` only). A student's code lives in an editable code node per task page;
`lib/board/code.ts` projects the board back into `projects.files` so homework review and the
server-side checks read plain files. Model is pinned to `deepseek-v4-flash` via the native
DeepSeek API for cost control — **do not change providers or models without approval**.

**Python runs in the browser, never on the server.** `public/py-worker.js` loads Pyodide in a
Web Worker with `public/py-runtime.py` (the `sparky` module: colors, the vault door, the alarm —
events collected by `lib/sparky-events.ts`). Node cannot run Python, which is why runtime task
checks are client-reported (below).

**Path alias**: `@/` maps to the repo root — kept in sync between `tsconfig.json` (`paths`) and
`jest.config.ts` (`moduleNameMapper`).

**Next.js 16 specifics**: `params` in every page and route handler is a `Promise` and must be
awaited.

## Patterns That Deviate From Defaults

**The driver is node-postgres, and that is load-bearing.** postgres.js loses queries on
reused pooled connections against Supabase's pooler — they never settle and never reject.
Measured at 8 concurrent queries x 3 rounds: postgres.js dropped 6, node-postgres 0. That hung
every `/staff` page in production while being invisible locally, where round trips are ~0.1ms
and queries rarely overlap. Two consequences in `lib/db/client.ts`: `db.execute()` returns a
`QueryResult`, so every call site goes through `rowsOf()` (they all fail closed — the wrong
shape denies access rather than throwing), and the timestamp parsers must be re-asserted on
the pool because drizzle-orm/node-postgres overrides them per query.

**Count in Postgres, and mind the round trips.** The `/staff` overview gathers ten numbers in
a single `SELECT` of scalar subqueries (`app/staff/overview-stats.ts`), not ten queries in a
`Promise.all`, and no page `select`s whole tables to compute `.length` in JS. Local
development points `DATABASE_URL` at localhost, so latency bugs are invisible until deploy —
test against the production database (`DATABASE_URL="<prod url>" bun run dev`) before trusting
a page that issues several queries.

**Homework is verified, gated, and reviewed.** Each lesson carries 2–3 `type: 'homework'` tasks
plus a `homeworkBrief`. Their board pages stay locked until every core task is done, and they
gate the tutor exactly like core tasks — `pendingCoreTask()` gates on `['core', 'homework']`. `POST /api/projects/[id]/submit` sets
`submission_status` to `'submitted'` and refuses with 409 unless `homeworkComplete()` agrees.
Teachers review at `/admin/homework` via `POST /api/admin/homework/[id]/review`, writing
`approved` or `needs_work` and inserting feedback as a `messages` row with `role: 'teacher'`
(mandatory when sending work back). `needs_work` lets the student resubmit. Teacher messages
render as their own bubble and relay to the LLM as `My teacher said: …`, since the model API
rejects a `teacher` role directly.

**Build mode does not exist yet.** `Lesson.aiPolicy` (`'tutor'` | `'director'`) is declared for
weeks 7–12, where the student is meant to direct the AI, but only `'tutor'` weeks exist and the
turn route does not read the field. The old per-user `user_build_mode` switch was dropped with
the web course (migration `0009`); a future director mode belongs in the turn route and the
tutor's tool set, not in a per-user admin toggle.

**Lesson tasks are verified, and the server has the last word.** Each task carries
`checks: TaskCheck[]` (`lib/task-checks.ts`), evaluated against the student's live file in the
browser to drive the UI. Recording a task as done goes through
`POST /api/projects/[id]/lesson-progress/complete`, which re-runs the task's **static** checks
(`lib/task-verify.ts`) against the code it has **stored** — never code from the request — and
refuses with 409 plus the failing check's hint. Its `PUT` sibling may
only ever *shrink* the set (that is how progress is reset); if it could still add an id the
verification would be one request away from irrelevant. Python lessons add runtime kinds
(`outputContains`, `worldContains`, `callReturns`) which run the student's program in a Pyodide
worker (`lib/python-checks.ts`, `public/py-worker.js`); `runTaskChecks` stays synchronous and
takes their verdicts. Node cannot run Python, so **runtime verdicts remain client-reported** and
ride along in the request — `verifyTask` applies a reported verdict only to a runtime check, so
a caller cannot use them to wave a static check through. Callers flush unsaved work
(`beforeComplete`) before completing, since the server judges what it has stored. The only
static kind is `sourceMatches` (regex + `min` + a documented `example`). Invariant:
`__tests__/unit/lib/py-lessons.test.ts` runs real Pyodide: no task passes on the untouched
starter, every task passes with the reference solution in `__tests__/fixtures/py/` (kept out of
`public/` so students cannot fetch it). A new week needs its `wN.py` starter, `wN-bugzap.py`,
and both solution fixtures.
Checks fail **open** whenever they cannot run (bad regex) — a broken check must never dead-end
a child. On the board, where nothing is clickable to move on, the escape hatch is 90s
on the same task, after which the task header offers "I am stuck — show me"; optional
(`choice`/`bonus`) tasks also carry "Skip this one", without which an unwanted bonus would wall
off the homework behind it. A task with no checks is never auto-completed.

**The board is one page per task.** `/board/[id]` (Python course, v3) has no task list and no
`Mark done`: page `t_<taskId>` *is* task `<taskId>` (`lib/board/tasks.ts`), its header shows the
task and a live checklist of what is still missing, and a task completes itself once its checks
pass — settle 800ms (`hooks/useAutoComplete.ts`), confetti, then the next task's page opens with
the code carried forward. The client owns those pages, so `board_new_page` is withheld from the
tutor in a lesson (`toolsFor`). A task's code is `pageCode(board, taskPageId(task))`, **not**
`boardCode`: boardCode spans the whole board and would hand an open task the code of a later
page the moment one appeared. A code node may name a `file` (bugzap.py); absent, it is the entry
file. There is no other student workspace: `/board/[id]` is where every project opens.

**The board tutor is gated by the same checks the student is.** `app/api/projects/[id]/turn`
reads `lesson_progress`, resolves the open task with `pendingCoreTask()` and appends
`buildTaskNudge(task, tier, results)`. Without it the model
narrates the lesson on vibes: it congratulates a student whose checks have not passed and
announces the next task while their board correctly refuses to move on.

**Student-facing lesson copy has a word budget.** `__tests__/unit/lib/lesson-copy.test.ts` caps
chips at 5 words, goals at 8, check labels at 6, hints at 10, bans vocabulary above roughly a
9-year-old ESL reading level, and caps total reading load. The course is pitched at 10–16, so
it keeps tight per-string caps, may use the Python words it teaches (`variable`), and gets a
per-lesson total (`300 × lessons`). Many
students still read English as a second language; long or advanced copy turns a lesson gate
into a reading test.

**The board autosaves; there is no Save button.** `CodeEditor` (CodeMirror, Python only) reports
typing upward after 300ms (driving checks); `LiveBoard` persists the board through
`PATCH /api/projects` (`board` is validated with `SavedBoard.safeParse` server-side). `CodeEditor`
must keep adopting external `code` changes while ignoring the echo of its own emissions
(`lastEmitted`), or a tutor edit arriving mid-keystroke gets overwritten.

**Admin API routes re-verify authorization themselves.** The route guard (`proxy.ts`) only
guards page navigation under `/admin`/`/teacher`/`/staff`. Every admin route file calls
`hasPermission(user.id, '<key>')` from `lib/auth/permissions.ts` (backed by `public.roles`,
`public.permissions`, `public.role_permissions`, `public.user_roles`, and the
`has_permission()`/`is_admin()` Postgres functions) as its first line. A new admin endpoint
without that check is unprotected. `ADMIN_EMAILS` is no longer the enforcement mechanism —
role assignment lives in `user_roles`, editable from `/admin/users`.

**Three roles exist, and `student` is granted automatically.**
`ensureStudentDefaults()` (`lib/auth/student-defaults.ts`, called from both `databaseHooks` in
`lib/auth/index.ts`) gives every non-admin, non-teacher account a `student_profiles` row *and* a
`student` role row on each sign-in — idempotent, and wrapped so it can never block a sign-in.
The role is seeded with **zero** `role_permissions` rows on purpose: it is an identity marker,
not a grant. It is system-managed, so `ASSIGNABLE_ROLES` in
`app/api/admin/users/[id]/roles/route.ts` still refuses it and `/staff/users` renders it as a
read-only badge. Roles are additive — a promoted student keeps both rows.

The consequence: **"has a `user_roles` row" no longer means "is staff".** The four pages under
`app/staff/` that need that distinction match against `STAFF_ROLES` from
`lib/auth/permissions.ts`; dropping that filter makes `/staff/students` and both class
student-pickers render empty. Note also that `class_members.role` uses the string `'student'`
for a different thing — per-class membership, not a platform role. The two tables never
interact.

**The route guard treats a missing `student_profiles` row as "not a student" and allows it
through.**
Only an explicit `is_active === false` redirects to `/login?reason=deactivated`.

**Redis is reached over one `REDIS_URL`, and it is optional.** `lib/redis.ts` builds an
`ioredis` client from `redis://` locally and `rediss://` in production (for Upstash, that is the
*Redis-protocol* endpoint, not the REST URL — `@upstash/redis` and its REST transport are gone).
An unset or malformed `REDIS_URL` exports `redis` as `null` rather than throwing, because both
callers fail open and the app must still boot and build without it. Three connection options are
load-bearing and explained in the file: `lazyConnect` (never dial during `next build`),
`maxRetriesPerRequest: 1` (bounds a failing command to ~200ms instead of ioredis's 20 retries),
and leaving `enableOfflineQueue` at its default — setting it to `false` alongside `lazyConnect`
makes the *first* command of every connection fail. Under `NODE_ENV=test` the URL comes from
`TEST_REDIS_URL` (default: db 15 on localhost) so tests cannot evict development cache entries.

**Rate limiting fails open.** `lib/ratelimit.ts` enforces 50 requests/hour per user id with a
sorted-set sliding window in a Lua script — one `EVALSHA` round-trip, atomic because a
`ZCARD`-then-`ZADD` pair would admit every request in a concurrent burst. A failed Redis call, or
no Redis at all, allows the request. Admins and teachers bypass it entirely
(`app/api/projects/[id]/turn/route.ts`). `prompts` remains the permanent log of every prompt (used by
homework review and admin views) but is no longer read to compute the limit.

**Read caching is a thin Redis wrapper, not a framework feature.** `lib/cache.ts`'s `cached()`
helper (get-or-set against Redis via `lib/redis.ts`, JSON-encoded since ioredis stores strings)
wraps a handful of
high-traffic, low-volatility reads: role/permission checks (`lib/auth/permissions.ts` —
`hasPermission`, `isAdmin`, `isTeacher`, `getStaffContext`, 30s TTL), a project's
`lesson_progress` (15s TTL plus explicit invalidation from both lesson-progress routes, since
it directly feeds the tutor's task gating), and a student's enabled-lesson ids
(`lib/lesson-availability.ts`, 60s TTL, no invalidation). A cache read/write failure never
changes the answer — it just falls through to the original fail-open or fail-closed DB call.

**Projects pin a catalog version; only version 3 exists.** `projects.lesson_version` is stamped
with `CURRENT_LESSON_VERSION` on creation and `getLessonForProject` resolves a lesson only for
that version — rows from the retired web course (version 2 or null) resolve to no lesson, earn
no XP, and open as an empty board. Never edit a catalog in place once students have progress on
it: `lesson_progress.completed_task_ids` stores task ids as plain strings, so bump the version
and add a catalog instead. Lesson ids start at 101 because `class_enabled_lessons` may still
hold the old ids 1–6 (migration `0009` clears them); a lesson is locked until a teacher enables
it for the student's class (admins and teachers bypass). A lesson names its `starterFile`
(`main.py`), optional `extraFiles` (seeded next to it, e.g. `bugzap.py`) and `aiPolicy`.

**XP, levels and badges are derived, the streak is stored.** `lib/xp.ts` computes XP from
`lesson_progress` + the catalog; a lesson's badge is won by its
`boss` task. Only the streak needs a table: `PUT …/lesson-progress` upserts one `activity_days`
row per user per day, in `APP_TIMEZONE` (default UTC). The plan's +5 solo/predict bonuses are
not built (progress does not record hint use or first-try guesses).

**Lesson tasks bind to code by string match.** Each task's `commentAnchor` (`# TASK: <id>`) is
searched for in the file text to drive line highlighting and the tutor's "point at the line"
nudges. Renaming an anchor comment in `public/templates/py/*.py` silently breaks it.

**Component tests need a jsdom docblock.** `jest.config.ts` sets `testEnvironment: 'node'`
globally, so every `.tsx` test starts with `/** @jest-environment jsdom */`.

## Config-Derived Facts

- `proxy.ts`'s matcher excludes `_next/static`, `_next/image`, `favicon.ico` and `api/auth` —
  the last deliberately, so the OAuth callback can complete without a session. `proxy.ts` replaced `middleware.ts` (deprecated in Next 16); Proxy
  defaults to the Node.js runtime, and setting the `runtime` config option there throws.
- `next.config.js` sets only `turbopack.root` (pinned because an unrelated `package-lock.json`
  in a parent directory made Turbopack infer the wrong workspace root).
- Linting is ESLint flat config (`eslint.config.mjs`): `@next/eslint-plugin-next` recommended +
  core-web-vitals, plus `react-hooks/rules-of-hooks` and `exhaustive-deps`. `next lint` no
  longer exists; the script is `eslint .`. The react-hooks plugin's current `recommended` set
  adds React Compiler rules that flag long-standing patterns here, so it's deliberately not
  enabled.
- `components.json` configures shadcn (style `base-nova`, `lucide` icons, RSC on).
- `.github/workflows/ci.yml` runs **lint, typecheck and test only** — deliberately no `build`
  step. The app deploys on Vercel, which builds every pull request as a preview and reports its
  own status check, so building here would duplicate that and hide nothing. It means `tsc
  --noEmit` is the only compile check CI performs: Next-specific build errors (a Server-only
  import pulled into a `'use client'` file, bad route config) surface on Vercel's check rather
  than this one. Make both checks required in branch protection.
- CI needs exactly `TEST_DATABASE_URL` and `TEST_REDIS_URL` — verified by running the suite with
  nothing else set. `DATABASE_URL` is intentionally unset there, so no development database
  exists in the job for a test to reach. Postgres and Redis are throwaway service containers;
  `jest.globalSetup.ts` migrates the test database as a precondition of running the suite.
  **Migrations against any deployed database are run by hand and are not part of CI.**
- No git hooks exist in the repository.

## Environment Variables

```
NEXT_PUBLIC_SITE_URL=
DATABASE_URL=                    # server-side only; the app's ONLY data connection (bypasses RLS), and the target of `bun run db:migrate`/`db:studio`
TEST_DATABASE_URL=               # server-side only; separate LOCAL database for Jest — must differ from DATABASE_URL
BETTER_AUTH_SECRET=              # server-side only; `openssl rand -base64 32`
BETTER_AUTH_URL=                 # the app's own origin; Better Auth builds the OAuth redirect from it
GOOGLE_CLIENT_ID=                # server-side only; Google Cloud Console OAuth client
GOOGLE_CLIENT_SECRET=            # server-side only
SUPERADMIN_EMAIL=                # server-side only; used once by `bun run db:seed:admin`
DEEPSEEK_API_KEY=                # server-side only
TELEGRAM_BOT_TOKEN=              # server-side only
REDIS_URL=                       # server-side only; OPTIONAL — backs lib/ratelimit.ts and lib/cache.ts
TEST_REDIS_URL=                  # server-side only; used when NODE_ENV=test (default: redis://127.0.0.1:6379/15)
APP_TIMEZONE=                    # OPTIONAL IANA zone (e.g. Asia/Phnom_Penh) for the streak's day boundary; default UTC
```

## Security Constraints

- Never expose `DATABASE_URL`, `DEEPSEEK_API_KEY`, or `TELEGRAM_BOT_TOKEN` to the browser; only
  `NEXT_PUBLIC_*` values may be referenced from `'use client'` files.
- All reads and writes go through server route handlers and Server Components using `db`, never
  from the browser.
- Because `db` connects as the owner and bypasses RLS, every query needs its own ownership or
  admin check.
- **RLS is on for all 21 tables with zero policies, and that is the design.**
  `drizzle/0002_postgrest_lockdown.sql` enables row security and revokes every
  `anon`/`authenticated` grant, including the default privileges. The application is unaffected
  (the owner bypasses RLS), so this costs nothing and closes the hole that a Supabase-hosted
  database leaves open: that project's PostgREST and its public anon key keep working whether or
  not the app uses them, and Supabase's default privileges would otherwise expose every table —
  reading `sessions.token` is session forgery, writing `user_roles` is privilege escalation.
  **A new table needs its own `enable row level security` line**; `bun run db:generate` will not
  write one.
- `/invoice/[id]` and `/receipt/[id]` perform no authorization; the id is the only access
  control.

## Known Issues

Pre-existing on a clean checkout — don't attribute these to your change:

- `bun run test:unit` and `bun run test:integration` find nothing — they pass
  `--selectProjects` but `jest.config.ts` defines no `projects`. Use `bun run test` or a path
  filter.
- `types/index.ts` has no interface for `app_settings`.
- `bun run lint` reports one `no-page-custom-font` warning in `app/layout.tsx`. Lint is a
  blocking CI step; warnings do not fail it.
- `components/SparkyWorld.tsx` and `components/PythonRunner.tsx` (the robot/vault canvas that
  draws `sparky` events) have no caller: the board evaluates `worldContains` checks but does not
  draw the world yet. `Lesson.scene` is set for that future board node.
- If stray `.claude/worktrees/agent-*/` directories exist (leftover from prior agent
  sessions — gitignored, don't delete without checking), `bun run lint` picks up the copies
  inside them and inflates the error count. Jest no longer has this problem:
  `jest.config.ts` sets `testPathIgnorePatterns` to skip `.claude/worktrees/`.

## Coding Style, Testing & Commit Conventions

TypeScript with the existing style: two-space indentation, single quotes, omitted semicolons,
strict types. Prefer the `@/` alias for root imports. PascalCase for React components
(`ProfileDropdown.tsx`), camelCase for utilities (`parse-multi-file.ts`), route handlers named
`route.ts`. Keep Client Components explicit with `'use client'`; don't move server-only logic
into them. Tailwind is the styling system — reuse `cn()` from `lib/utils.ts` and existing
`components/ui` primitives before adding duplicate UI patterns.

Jest is configured through `jest.config.ts` with Testing Library support. Name tests
`*.test.ts`/`*.test.tsx`, place them under the matching `__tests__/unit/` or
`__tests__/integration/` area. Test observable behavior against the real test database — mock
only genuinely external services (DeepSeek, Telegram) — and cover error paths for API and
persistence logic. `jest.config.ts` pins `maxWorkers: 1`: every database-backed suite shares one
`TEST_DATABASE_URL` and truncates it between tests, so parallel workers wipe each other's rows
and unrelated suites fail at random. Run focused tests during
development, then `bun run test` before opening a pull request.

Schema changes go through `lib/db/schemas/*.ts` → `bun run db:generate` → `./drizzle` → `bun run
db:migrate` — see the Drizzle paragraph above and `drizzle/README.md`. On a fresh database,
`bun run db:migrate` alone applies the full migration history from `./drizzle`.

Commits: concise imperative style, preferably Conventional Commits —
`feat(admin): add class schedule editor`, `fix: enforce rate limit`,
`refactor: simplify editor state`. Keep each commit focused. Pull requests should explain the
user-facing change, note migrations or environment-variable changes, link the related issue
when available, and include screenshots for visible UI changes.

## Key Entry Points

| Concern                                      | File                                                |
| -------------------------------------------- | --------------------------------------------------- |
| Route guards, admin gate, deactivation check | `proxy.ts`                                          |
| Authentication (Better Auth + Google)        | `lib/auth/index.ts`, `lib/auth/session.ts`          |
| Student workspace (the board)                | `app/board/[id]/page.tsx` → `app/board/LiveBoard.tsx` |
| Tutor turn (LLM + board tools)               | `app/api/projects/[id]/turn/route.ts`, `lib/tutor/`  |
| Project CRUD                                 | `app/api/projects/route.ts`                         |
| LLM client                                   | `lib/deepseek.ts` (prompts: `lib/tutor/prompt.ts`)   |
| Database client (the only data path)         | `lib/db/client.ts`, `lib/db/schemas/*.ts` (barrel: `lib/db/schema.ts`) |
| Lesson catalog                               | `lib/lessons.ts`, `lib/py-lessons.ts`, `public/templates/py/` |
| XP / levels / badges / streak                | `lib/xp.ts`, `lib/player-stats.ts`                  |
| Task verification (client UI)                | `lib/task-checks.ts`                                |
| Task verification (server, authoritative)    | `lib/task-verify.ts`, `.../lesson-progress/complete` |
| Board task pages / auto-advance              | `lib/board/tasks.ts`, `hooks/useAutoComplete.ts`    |
| Rate limiting (Redis + Lua)                  | `lib/ratelimit.ts`                                  |
| Read caching (Redis)                         | `lib/cache.ts`, `lib/redis.ts`                      |
| Schema of record                             | `drizzle/` (authored via `lib/db/schemas/*.ts`)      |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
