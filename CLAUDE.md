# CLAUDE.md

Guidance for Claude Code in this repository. This file is the always-loaded rulebook and
index; the _how it works_ detail lives in topic skills under `.claude/skills/` (table at the
bottom) so it loads only when relevant. Read the matching skill before exploring a subsystem.

## What this is

Student Code Builder: an AI-assisted Python platform for students aged 10–16. A 12-week
course (catalog version 3; weeks 1–6 exist) where the LLM tutors on a shared board
(`/board/[id]`, the only student workspace) and Python runs in the browser via Pyodide.
Teachers/admins run classes, review homework and send invoices/receipts over Telegram from a
back office (`/staff`). The HTML/CSS/JS course, srcdoc editor, free-form projects and public
gallery were removed in September 2026 — do not reintroduce them.

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
  approval. The tutor edits the board through tools; it never returns files. (`ai-tutor`)
- Python runs only in the browser. Runtime check verdicts are client-reported and the server
  applies them **only** to runtime checks; static checks are re-run on stored code. Only
  `POST …/lesson-progress/complete` may add a task id. (`lesson-progress`)
- Never edit lesson catalog v3 in place once students have progress; bump
  `CURRENT_LESSON_VERSION`. Renaming a `# TASK: <id>` anchor silently breaks highlighting.
  Student copy has word budgets enforced by tests. (`lesson-authoring`)
- Schema changes: edit `lib/db/schemas/<table>.ts` → `bun run db:generate` → hand-add what the
  DSL can't express (`--custom`) → `bun run db:migrate` → update `types/index.ts` by hand. A
  new table needs an `export *` in `lib/db/schema.ts` and an `enable row level security` line.
  `drizzle-kit push`/`pull` are banned. Keep explicit snake_case column strings. (`database`)
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
| task checks, verify, complete, homework submit/review, enabled lessons, autosave           | `lesson-progress`       |
| adding a week/task, templates, anchors, fixtures, word budgets, catalog version            | `lesson-authoring`      |
| XP, levels, badges, streak, `activity_days`, `APP_TIMEZONE`                                | `xp-and-streak`         |
| issue → branch → PR loop                                                                   | `issue-workflow`        |

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
