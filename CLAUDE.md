# CLAUDE.md

Guidance for Claude Code in this repository. This file is the always-loaded rulebook and
index; the _how it works_ detail lives in topic skills under `.claude/skills/` (table at the
bottom) so it loads only when relevant. Read the matching skill before exploring a subsystem.

## What this is

Student Code Builder: an AI-assisted Python platform for students aged 11–16. A 12-week
course (catalog version 3; weeks 1–6 exist) where the LLM tutors on a shared board
(`/board/[id]`, the only student workspace) and Python runs in the browser via Pyodide.
Teachers/admins run classes and send invoices/receipts over Telegram from a back office
(`/staff`).

**The platform is Python-only.** There is no HTML editor, web preview, free-form project or
public gallery — do not add them. Anything that still references such things (see Known
issues) is a dead remnant to delete or move toward the Python model, not a second track.

Product intent, roadmap and feature specs live in `specs/` (mission, tech-stack, roadmap,
`features/`). Start a roadmap phase with the `feature-spec` skill.

## Commands

Use `bun`. Scripts run as `bun run <script>` — `bun test` is bun's own runner, not Jest.

```bash
bun run dev              # dev server (Turbopack)
bun run build            # production build
bun run test             # all Jest tests (sets NODE_OPTIONS=--experimental-vm-modules for Pyodide suites)
bun run lint             # eslint .
bun run format           # prettier --write . (CI runs format:check; run this before pushing)
bun run db:generate      # derive DDL from lib/db/schemas/*.ts into drizzle/
bun run db:migrate       # apply drizzle/ to DATABASE_URL (db:migrate:test → TEST_DATABASE_URL)
bun run db:studio        # Drizzle Studio
bun run db:seed:admin    # first admin from SUPERADMIN_EMAIL
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/ratelimit.test.ts   # one file
```

Tests run against a **real** Postgres (`TEST_DATABASE_URL`, migrated by `jest.globalSetup.ts`,
truncated between tests) and are serialised (`maxWorkers: 1`). `test:unit`/`test:integration`
are broken — use a path filter.

## Hard rules

Each rule's rationale is in the skill named in parentheses.

- `db` connects as the owner and **bypasses RLS**: every query carries its own ownership
  predicate (`eq(table.userId, user.id)`) or sits under an explicit permission check. Prefer a
  `where` clause over fetch-then-compare. (`database`)
- Ids from a path or query string go through `isUuid()` (`lib/db/uuid.ts`) before any query;
  Postgres errors **throw** — keep each caller's fail-open/closed choice. (`database`)
- Never import `db` in a `'use client'` file; only `NEXT_PUBLIC_*` may reach the browser.
- Every API route authenticates with `getSessionUser()` (`lib/auth/session.ts`) and, under
  `app/api/admin/`, authorises with `hasPermission(user.id, '<key>')` / `isAdmin()` as its first
  lines. `proxy.ts` guards page navigation only. (`roles-permissions`, `auth-flow`)
- Renaming a property on `users`/`sessions`/`accounts`/`verifications` breaks sign-in at runtime
  with no compile error. (`auth-flow`)
- The model is `deepseek-v4-flash` in `lib/deepseek.ts` — no provider/model change without
  approval. The tutor edits the board through tools; it never returns files. Concept steps
  (`choose`/`try`/`learn`/`order`/`bug`/`match`/`stage`) are graded on the client with no LLM
  call; run `bun --env-file=.env run scripts/tutor-eval.ts` after any prompt change (not in
  CI). (`ai-tutor`)
- Python runs only in the browser, so stdout is browser-reported. **The tutor decides a task
  is done; the server records it.** The client never completes a task: the tutor calls the
  `task_complete` tool, the turn route guards it (open `pendingCoreTask`, editor open —
  `awaitingEditor` withholds the tool —, backed by a real run, static checks re-pass on
  stored code via `verifyTask`) and `recordTaskDone` (`lib/task-progress.ts`) is the **only**
  writer that grows `lesson_progress`. `PUT …/lesson-progress` may only shrink. (`lesson-progress`)
- The lesson catalog (`lib/py-lessons.ts`) is read live: content edits (checks, prompts, steps,
  wording) reach every student immediately, old and new, and need no version bump. A shipped
  task id or its `# TASK: <id>` anchor is different — `lesson_progress` stores ids as plain
  strings and a board node's anchor is baked in at creation, so renaming or removing one
  un-completes a finished task for students who already have it. Never rename/remove a shipped
  id without adding it to `TASK_ID_ALIASES` (`lib/lessons.ts`); `py-lessons.test.ts` +
  `__tests__/fixtures/frozen-task-ids.json` enforce this in CI. Starters are TS strings in
  `lib/lessons/templates.ts`, never files under `public/`. Student copy has word budgets
  enforced by tests. (`lesson-authoring`)
- Schema changes: edit `lib/db/schemas/<table>.ts` → `bun run db:generate` → hand-add what the
  DSL can't express (`--custom`) → `bun run db:migrate` → update `types/index.ts` by hand. A
  new table needs an `export *` in `lib/db/schema.ts` and an `enable row level security` line.
  `drizzle-kit push`/`pull` are banned. Keep explicit snake_case column strings. Latest
  migration: `0010` (`task_progress`, the audit row behind every completed task). (`database`)
- Next 16: `params` is a `Promise` — await it. `.tsx` tests start with
  `/** @jest-environment jsdom */`. Read `node_modules/next/dist/docs/` before assuming an API.

## Style and commits

TypeScript, two-space indent, single quotes, no semicolons, strict types, `@/` imports.
PascalCase components, camelCase utilities, `route.ts` handlers. Route-specific client
components live beside their route; only reusable UI goes in `components/`. Tailwind with
`cn()` and `components/ui` primitives. Tests: `*.test.ts(x)` under `__tests__/unit|integration`
mirroring the source; mock only DeepSeek/Telegram. Commits: Conventional Commits
(`feat(admin): …`, `fix: …`); PRs explain the user-facing change and note migrations/env changes.

## Skills index

| When the task involves…                                                                    | Skill                   |
| ------------------------------------------------------------------------------------------ | ----------------------- |
| stack, folder layout, where X lives, Next 16 specifics, config, CI, jest harness, env vars | `project-architecture`  |
| queries, Drizzle, `db`, migrations, tables, columns, RLS, `isUuid`, `rowsOf`               | `database`              |
| login, sessions, Google OAuth, Better Auth, `proxy.ts`, deactivation, `/no-class`          | `auth-flow`             |
| roles, permission keys, `hasPermission`, `/staff` gating, assigning roles                  | `roles-permissions`     |
| Redis, `cached()`, TTLs, invalidation, rate limit / 429                                    | `redis-cache-ratelimit` |
| tutor prompt, DeepSeek, turn route, board tools/reducer, SSE, LiveBoard, Pyodide, trace    | `ai-tutor`              |
| task checks, verify, complete, enabled lessons, autosave                                   | `lesson-progress`       |
| adding a week/task, templates, anchors, fixtures, word budgets, catalog version            | `lesson-authoring`      |
| XP, levels, badges, streak, `activity_days`, `APP_TIMEZONE`                                | `xp-and-streak`         |
| issue → branch → PR loop                                                                   | `issue-workflow`        |
| planning the next roadmap phase, writing a feature spec                                    | `feature-spec`          |

## Known issues (pre-existing; not yours)

- `bun run lint` reports one `no-page-custom-font` warning in `app/layout.tsx`.
- `next.config.js` headers still target `/editor/*` and `/templates/*.html`; `/board` is not
  cross-origin isolated, so Python `input()` uses the fallback path there.
- `types/index.ts` has no interface for `app_settings`.
- `components/SparkyWorld.tsx`, `components/PythonRunner.tsx` and the `/board` fixture demo have
  no live caller. Comments still mention `/api/generate`, "build mode" and "Mark done".

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
