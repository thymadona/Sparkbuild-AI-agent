# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## What This Project Is

Student Code Builder: an AI-assisted coding platform for students aged 10–16. Students work
through a 6-week lesson track, prompting an LLM that either tutors (ask mode) or generates a
complete HTML/CSS/JS file (build mode), rendered live in a sandboxed iframe. Teachers and
admins run classes, review homework, and manage invoices/receipts (delivered over Telegram)
through a back office.

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
bunx jest __tests__/unit/lib/ratelimit.test.ts   # Single test file
```

**Tests run against a real Postgres**, not mocks of one: `TEST_DATABASE_URL` points at a
separate database (`spark_build_test`) that `jest.globalSetup.ts` migrates before any suite and
that `__tests__/helpers/db.ts` truncates between tests. `lib/db/client.ts` refuses to start if
`TEST_DATABASE_URL` equals `DATABASE_URL`, so a test run can't wipe development data. Each
database keeps its own `drizzle.__drizzle_migrations` ledger, so dev and test track
independently. Fixtures (`makeUser`, `grantRole`, `makeClass`, `addClassMember`) live in
`__tests__/helpers/db.ts`.

`bun run test:unit` / `bun run test:integration` are broken (`--selectProjects` with no
`projects` defined in `jest.config.ts`) — use `bun run test` or a path filter instead.

## Architecture

Three subsystems share one Next.js 16 (App Router) + React 19 codebase:

1. **Editor** (`app/editor/[id]/`, `components/Editor.tsx`) — student prompts hit
   `POST /api/generate`, which streams from DeepSeek via the `openai` SDK pointed at DeepSeek's
   `baseURL` (`lib/gemini.ts` — despite the filename, no Gemini code) and renders into a
   sandboxed `srcdoc` iframe (`components/Preview.tsx`).
2. **Lessons** (`app/lessons/`, `lib/lessons.ts`, `lib/task-checks.ts`, `public/templates/`) —
   weekly lessons backed by HTML templates with in-file task anchors, code-aware task
   verification, and gated homework.
3. **Admin back office** (`app/admin/`, `app/api/admin/`, `components/admin/`) — student
   accounts, classes with weekly schedules, homework review, and invoices/receipts delivered to
   parents over Telegram.

**Colocation rule:** route-specific client components live beside their route
(`app/editor/[id]/EditorLayout.tsx`, `app/admin/classes/ClassesClient.tsx`). Only genuinely
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

**Naming: camelCase in TypeScript, snake_case in Postgres.** Every column in `lib/db/schema.ts`
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
no longer exists. Workflow for a schema change: edit `lib/db/schema.ts` first, run
`bun run db:generate` (diffs against the snapshot in `./drizzle`, safe — see below) to derive
DDL into `./drizzle`, hand-add whatever Drizzle's DSL can't express (RLS policies, grants,
security-definer functions, data backfills — `drizzle-kit generate --custom` for those), then
`bun run db:migrate` to apply it directly against `DATABASE_URL`. `drizzle-kit push` and `pull`
are permanently off limits against this schema — `drizzle.config.ts`'s header comment explains
why (an upstream drizzle-kit bug makes them hang or crash; `lib/db/schema.ts`'s header and
`drizzle/README.md` cover the rest of the workflow, including the consequence that if the
database is hosted on Supabase, that project's own migration dashboard/`db reset`/MCP branching
tools no longer reflect schema state).

**The LLM contract is delimiter-based and full-file.** Build responses must be
`--- FILE: <name> ---` … `--- DONE ---` blocks followed by a summary sentence, parsed by
`lib/parse-multi-file.ts`; `/api/generate` classifies a response as code with
`trimStart().startsWith('--- FILE:')`. Files are replaced wholesale — no diff or patch format.
Changing the delimiters means changing the prompt, the parser, and the classification check
together. Model is pinned to `deepseek-v4-flash` via the native DeepSeek API for cost control —
**do not change providers or models without approval**. (`/api/generate` also logs stream
failures as `'OpenRouter stream error:'` — a stale provider name in the log line, not a real
dependency.)

**Preview is `srcdoc`-only, deliberately** — no WebContainer, Sandpack, or CodeSandbox SDK. The
iframe is sandboxed with `sandbox="allow-scripts allow-forms"` (no `allow-same-origin`, so the
frame stays an opaque origin). A console-interceptor script is injected after `<head>` and
forwards `console.*`/errors to the
parent via `postMessage({ type: '__console__' })`; it also shims `localStorage`/`sessionStorage`
(unavailable in the opaque-origin frame). `lib/combine.ts` inlines `style.css` and `script.js`
by exact filename and strips external `<link>`/`<script src>` tags before rendering.

**Path alias**: `@/` maps to the repo root — kept in sync between `tsconfig.json` (`paths`) and
`jest.config.ts` (`moduleNameMapper`).

**Next.js 16 specifics**: `params` in every page and route handler is a `Promise` and must be
awaited.

## Patterns That Deviate From Defaults

**Homework is verified, gated, and reviewed.** Each lesson carries 2–3 `type: 'homework'` tasks
plus a `homeworkBrief`. They're hidden in the task panel until every core task is done, live in
their own section, and hold back build mode exactly like core tasks —
`pendingCoreTask()` gates on `['core', 'homework']`. `POST /api/projects/[id]/submit` sets
`submission_status` to `'submitted'` and refuses with 409 unless `homeworkComplete()` agrees.
Teachers review at `/admin/homework` via `POST /api/admin/homework/[id]/review`, writing
`approved` or `needs_work` and inserting feedback as a `messages` row with `role: 'teacher'`
(mandatory when sending work back). `needs_work` lets the student resubmit. Teacher messages
render as their own bubble and relay to the LLM as `My teacher said: …`, since the model API
rejects a `teacher` role directly.

**Build mode is server-authoritative, and lessons withhold it.** The client may send
`mode: 'build'`, but `/api/generate` grants it only if `user_build_mode.enabled` is true for
that user **and** `pendingCoreTask()` returns null. While a task is open, the request is
downgraded to ask mode and `buildTaskNudge()` is appended to the system prompt forbidding code.
The response carries `X-Effective-Mode` and `X-Open-Task` headers so the client can explain the
downgrade instead of looking broken. Only `POST /api/admin/settings` writes
`user_build_mode`.

**Lesson tasks are verified, not self-reported.** Each task in `LESSONS` carries
`checks: TaskCheck[]` (`lib/task-checks.ts`), evaluated against the student's live file in the
browser; `Mark done` stays disabled until they pass. Two invariants, enforced by
`__tests__/unit/lib/task-checks.test.ts`: no task may pass on its untouched starter template,
and every `textChanged` check must resolve to an element that actually holds the `from` text.
Checks fail **open** whenever they cannot run (no DOM, bad regex) — a broken check must never
dead-end a child. The escape hatch requires both 90s on task and a hint request.
`LEGACY_LESSONS` has no checks and stays self-reported.

**Student-facing lesson copy has a word budget.** `__tests__/unit/lib/lesson-copy.test.ts` caps
chips at 5 words, goals at 8, check labels at 6, hints at 10, bans vocabulary above roughly a
9-year-old ESL reading level, and caps total reading load. The audience is 8–13 reading English
as a second language; long or advanced copy turns a lesson gate into a reading test.

**The editor autosaves; there is no Save button in lesson projects.** `CodeEditor` reports
typing upward after 300ms (driving preview and checks); `EditorLayout` writes to
`/api/projects` after 1200ms idle, coalesced through `pendingFilesRef` with an in-flight guard.
`CodeEditor` must keep adopting external `code` changes while ignoring the echo of its own
emissions (`lastEmitted`), or a generation arriving while mounted in split view gets
overwritten. One step of undo is kept in `undoFiles`, discarded as soon as the student types.

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
(`app/api/generate/route.ts`). `prompts` remains the permanent log of every prompt (used by
homework review and admin views) but is no longer read to compute the limit.

**Read caching is a thin Redis wrapper, not a framework feature.** `lib/cache.ts`'s `cached()`
helper (get-or-set against Redis via `lib/redis.ts`, JSON-encoded since ioredis stores strings)
wraps a handful of
high-traffic, low-volatility reads: role/permission checks (`lib/auth/permissions.ts` —
`hasPermission`, `isAdmin`, `isTeacher`, 30s TTL), a project's `lesson_id`/`lesson_version`
(`app/api/generate/route.ts`, 1h TTL — these never change post-creation), a project's
`lesson_progress` (15s TTL plus explicit invalidation from the lesson-progress PUT route, since
it directly feeds build-mode task gating), a user's `user_build_mode.enabled` (30s TTL plus
explicit invalidation from `POST /api/admin/settings`), and a student's enabled-lesson ids
(`lib/lesson-availability.ts`, 60s TTL, no invalidation). A cache read/write failure never
changes the answer — it just falls through to the original fail-open or fail-closed DB call.

**Lesson versioning uses parallel catalogs, not migrations.** `getLessonForProject` reads the
current catalog only when a project's `lesson_version` equals `CURRENT_LESSON_VERSION`, else
the legacy catalog. Old projects keep their original task ids since
`lesson_progress.completed_task_ids` stores those ids as plain strings. Bump the version by
adding a catalog — never edit the old one in place.

**Lesson tasks bind to code by string match.** Each task's `commentAnchor` is searched for in
the file text to drive editor highlighting. Renaming an anchor comment in
`public/templates/*.html` silently breaks it.

**Component tests need a jsdom docblock.** `jest.config.ts` sets `testEnvironment: 'node'`
globally, so every `.tsx` test starts with `/** @jest-environment jsdom */`.

## Config-Derived Facts

- `proxy.ts`'s matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `api/auth`, and
  `share` — the last two deliberately, so the OAuth callback can complete without a session and
  share pages stay public. `proxy.ts` replaced `middleware.ts` (deprecated in Next 16); Proxy
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
- `types/index.ts` has no interfaces for `app_settings` or `user_build_mode`.
- `bun run lint` reports 6 pre-existing `no-html-link-for-pages` errors
  (`components/Footer.tsx`, `app/share/[id]/page.tsx`, `app/about/page.tsx`,
  `app/dashboard/DashboardClient.tsx` use `<a>` where `<Link>` belongs) and one
  `no-page-custom-font` warning in `app/layout.tsx`. These predate the Next 16 upgrade, so the
  CI workflow runs lint with `continue-on-error: true`; make it blocking once they're fixed.
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

Schema changes go through `lib/db/schema.ts` → `bun run db:generate` → `./drizzle` → `bun run
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
| Student workspace                            | `app/editor/[id]/page.tsx` → `EditorLayout.tsx`     |
| LLM pipeline                                 | `app/api/generate/route.ts`                         |
| Project CRUD                                 | `app/api/projects/route.ts`                         |
| LLM client + system prompts                  | `lib/gemini.ts`                                     |
| Database client (the only data path)         | `lib/db/client.ts`, `lib/db/schema.ts`              |
| Lesson catalog + versioning                  | `lib/lessons.ts`                                    |
| Task verification                            | `lib/task-checks.ts`                                |
| Rate limiting (Redis + Lua)                  | `lib/ratelimit.ts`                                  |
| Read caching (Redis)                         | `lib/cache.ts`, `lib/redis.ts`                      |
| Schema of record                             | `drizzle/` (authored via `lib/db/schema.ts`)         |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
