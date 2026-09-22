---
name: project-architecture
description: 'The map of this codebase — tech stack (Next.js 16 App Router, React 19, TypeScript, Tailwind 3 + shadcn, Drizzle/node-postgres, Better Auth, ioredis, DeepSeek, Pyodide), the three subsystems (board + tutor, lessons, staff back office) and which directories hold each, the colocation rule, Next 16 specifics (`params` Promise, `proxy.ts` not `middleware.ts`), config facts (`next.config.js` headers, ESLint flat config, `@/` alias, `components.json`), CI (lint · format · typecheck · test, no build — Vercel builds), the Jest harness (real Postgres + Redis, `maxWorkers: 1`, jsdom docblock, Pyodide under Node), env vars, and known dead code. Use for anything mentioning architecture, tech stack, project structure, folder layout, where does X live, which file, overview, onboarding, Next.js 16, App Router, Server vs Client Component, colocation, config, CI, GitHub Actions, Vercel, deploy, Turbopack, ESLint, tsconfig, jest config, test setup, env var, .env, cross-origin isolation. Use this before exploring the tree with `ls`/`find` — it already maps it.'
---

# Project architecture

Student Code Builder: AI-assisted Python platform for ages 10–16. One Next.js 16 (App Router)

- React 19 + TypeScript codebase, three subsystems. Deployed on Vercel. Package manager is
  **bun** (`bun run <script>`, never `bun <script>` — bun's own test runner is not Jest).

## Stack

| Layer          | Choice                                                                                                      | Notes                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework      | Next.js 16 App Router, React 19                                                                             | `params` is a `Promise` in every page/route — `await` it. `proxy.ts` replaced `middleware.ts`. Read `node_modules/next/dist/docs/` before assuming an API. |
| Styling        | Tailwind 3, shadcn (`components.json`: style `base-nova`, `lucide` icons, RSC on), `cn()` in `lib/utils.ts` | Primitives in `components/ui/` (badge, button, card, dropdown-menu, skeleton, table, tabs). Reuse before adding.                                           |
| Editor         | CodeMirror 6 via `@uiw/react-codemirror`, Python only                                                       | `components/CodeEditor.tsx`                                                                                                                                |
| Data           | Postgres 17 via Drizzle + node-postgres (`pg`)                                                              | `database` skill                                                                                                                                           |
| Auth           | Better Auth, Google only                                                                                    | `auth-flow` skill                                                                                                                                          |
| Cache / limits | ioredis, optional                                                                                           | `redis-cache-ratelimit` skill                                                                                                                              |
| LLM            | DeepSeek `deepseek-v4-flash` through the `openai` SDK                                                       | `ai-tutor` skill                                                                                                                                           |
| Python         | Pyodide 0.27 in a Web Worker (browser only)                                                                 | `ai-tutor` skill                                                                                                                                           |
| Messaging      | Telegram Bot API by raw `fetch` (invoices/receipts to parents)                                              | `app/api/admin/telegram`, `app/api/admin/invoices/[id]/send`                                                                                               |
| Tests          | Jest 30 + Testing Library, ESLint 9 flat config                                                             | below                                                                                                                                                      |

## Subsystems and directories

| Subsystem                                                                             | Server                                                                                                                       | Client                                                                                                             | Library                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Board + tutor** (the only student workspace, `/board/[id]`)                         | `app/board/[id]/page.tsx`, `app/api/projects/[id]/turn/route.ts`                                                             | `app/board/LiveBoard.tsx`, `useTutor.ts`, `BoardView.tsx`, `Nodes.tsx`, `TaskHeader.tsx`, `Mascot.tsx`             | `lib/tutor/`, `lib/board/`, `lib/deepseek.ts`, `hooks/usePythonRunner.ts`, `public/py-worker.js`, `public/py-runtime.py`, `lib/sparky-events.ts`                                                                                                                                                                                  |
| **Lessons** (catalog, checks, progress, XP)                                           | `app/lessons/page.tsx`, `app/lessons/[id]/page.tsx`, `app/api/projects/**`                                                   | `app/lessons/LessonsClient.tsx`, `LessonDetailClient.tsx`, `hooks/use{TaskChecks,RuntimeChecks,LessonProgress}.ts` | `lib/lessons.ts`, `lib/py-lessons.ts`, `lib/lessons/templates.ts` (starters), `lib/task-checks.ts`, `lib/task-verify.ts`, `lib/task-evidence.ts`, `lib/task-progress.ts`, `lib/task-guard.ts`, `lib/python-checks.ts`, `lib/python-check-client.ts`, `lib/lesson-*.ts`, `lib/starter-file.ts`, `lib/xp.ts`, `lib/player-stats.ts` |
| **Staff back office** (`/staff/*` live; `/admin/*`, `/teacher/*` are redirect shells) | `app/staff/**/page.tsx`, `app/staff/overview-stats.ts`, `app/api/admin/{classes,students,invoices,schedules,telegram,users}` | `app/staff/**/*Client.tsx`, `components/admin/`, `components/dashboard/`                                           | `lib/auth/permissions.ts`, `lib/dashboard-nav.ts`                                                                                                                                                                                                                                                                                 |

Other routes: `app/login`, `app/register`, `app/no-class`, `app/profile`, `app/about`,
`app/invoice/[id]`, `app/receipt/[id]` (**no authorization — the id is the access control**),
`app/api/auth/[...all]`, `app/api/profile`. Root `proxy.ts` is the route guard.

**Colocation rule:** route-specific client components live beside their route
(`app/board/LiveBoard.tsx`, `app/staff/classes/ClassesClient.tsx`); only genuinely reusable UI
goes in `components/`. A `page.tsx` next to a `*Client.tsx` is a server-fetch / client-interact
pair. Keep `'use client'` explicit; never move server-only logic (or `db`) into one.

## Config facts

- `next.config.js`: `turbopack.root = __dirname` (an unrelated parent `package-lock.json` made
  Turbopack pick the wrong root) **and** `headers()`: COOP/COEP `credentialless` on
  `/editor/:path*` and `/py-worker.js`, cache headers on `/templates/:path*.html`. Both patterns
  predate the board: `/board` is **not** cross-origin isolated, so `usePythonRunner().isolated`
  is false there and Python `input()` cannot use SharedArrayBuffer; templates are `.py` now.
- `proxy.ts` `config.matcher` excludes `_next/static`, `_next/image`, `favicon.ico`, `api/auth`.
  Proxy runs on Node; setting the `runtime` option throws.
- `eslint.config.mjs`: `@next/eslint-plugin-next` recommended + core-web-vitals +
  `react-hooks/rules-of-hooks` (error) + `exhaustive-deps` (warn). The plugin's React Compiler
  rules are deliberately **not** enabled. `next lint` no longer exists; script is `eslint .`.
  Ignores `public/**`. One known `no-page-custom-font` warning in `app/layout.tsx`.
- `@/` → repo root, in both `tsconfig.json` `paths` and `jest.config.ts` `moduleNameMapper`.
- `drizzle.config.ts` / `drizzle.test.config.ts` — `database` skill.
- No git hooks. `.mcp.json` still lists a Supabase MCP server (unused by the app).

## CI (`.github/workflows/ci.yml`)

On PRs to `main`: `bun install --frozen-lockfile` → `bun run lint` → `bun run format:check` → `bunx tsc --noEmit` →
`bun run test`. Postgres 17 and Redis 8 are throwaway service containers; env is exactly
`NODE_ENV=test`, `TEST_DATABASE_URL`, `TEST_REDIS_URL` (`DATABASE_URL` deliberately unset).
**No build step** — Vercel builds every PR as a preview and reports its own check, so
Next-specific build errors (server-only import in a client file, bad route config) surface
there, not in CI. Migrations against deployed databases are run by hand, never by CI.

## Test harness

- `jest.config.ts`: `next/jest`, `testEnvironment: 'node'` (so every `.tsx` test starts with
  `/** @jest-environment jsdom */`), `globalSetup` = `jest.globalSetup.ts` (runs
  `bun run db:migrate:test`), `setupFilesAfterEnv` = `jest.setup.ts` (mocks `@/lib/redis` and
  `@/lib/auth/client` globally — better-auth is ESM-only), `maxWorkers: 1` (one shared test DB
  truncated between tests), ignores `.claude/worktrees/` and `__tests__/helpers/`.
- `__tests__/helpers/db.ts`: truncation + fixtures `makeUser`, `grantRole`, `makeClass`,
  `addClassMember`. `__tests__/helpers/pyodide.ts`: real Pyodide under Node (`nodeExec`) —
  needs `NODE_OPTIONS=--experimental-vm-modules`, which `bun run test` sets; a bare `jest`
  fails those suites with "dynamic import callback".
- Layout mirrors the source: `__tests__/unit/{lib,hooks,components,app}`, `__tests__/integration/{api,…}`.
  Mock only external services (DeepSeek, Telegram); everything else hits the real test DB.
- `bun run test:unit` / `test:integration` are broken (`--selectProjects` with no `projects`).
  Use `bun run test` or a path filter.

## Environment variables (source of truth: `.env.local.example`)

`DATABASE_URL` (only data connection; migrate target) · `TEST_DATABASE_URL` (must differ) ·
`BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` (own origin; OAuth redirect is built from it) ·
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` · `SUPERADMIN_EMAIL` / `SUPERADMIN_NAME`
(`db:seed:admin`) · `DEEPSEEK_API_KEY` · `TELEGRAM_BOT_TOKEN` · `NEXT_PUBLIC_SITE_URL` ·
`REDIS_URL` (optional) · `TEST_REDIS_URL` (default db 15) · `APP_TIMEZONE` (optional, streak
day boundary). Only `NEXT_PUBLIC_*` may be referenced from `'use client'` files. Scripts that
touch the DB run with `bun --env-file=.env` (see `package.json`) — keep `.env` and
`.env.local` in sync for `db:*` commands.

## History you will see traces of

The HTML/CSS/JS course (catalog v1–2), its srcdoc preview editor at `/editor/[id]`,
`/api/generate` with build mode, free-form projects, `/explore` gallery, Supabase Auth and
PostgREST access were removed in Aug–Sep 2026. Comments, `PROGRESS.md` (a phase-by-phase build
log of the board) and `drizzle/_archive/` still mention them. Do not reintroduce them; `Lesson.aiPolicy`
'director' (weeks 7–12) is declared but unbuilt.

## Known dead code

`app/board/page.tsx` + `BoardClient.tsx` + `fixture.ts` (scripted demo at `/board`);
`components/SparkyWorld.tsx`, `components/PythonRunner.tsx` (no caller); `lib/tutor/prompt.ts`
`PAGE_RULE` mentions "a different screen"; `types/index.ts` has no `app_settings` interface.
