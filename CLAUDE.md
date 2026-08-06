# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` next.** It documents repo-specific patterns, gotchas, and known issues in far more depth than belongs here, and it is kept current. The `.agents/summary/` directory behind it has full detail per topic (architecture, interfaces, data models, workflows, dependencies, review notes). Don't duplicate that work — this file only covers commands and the big-picture shape.

## What This Project Is

Student Code Builder: an AI-assisted coding platform for students aged 10–16. Students work through a 6-week lesson track, prompting an LLM that either tutors (ask mode) or generates a complete HTML/CSS/JS file (build mode), rendered live in a sandboxed iframe. Teachers and admins run classes, review homework, and manage invoices/receipts (delivered over Telegram) through a back office.

## Commands

Use `bun` — the repo ships `bun.lock`. Scripts must be run as `bun run <script>`, not `bun <script>`: bun's built-in test runner is a different tool from Jest and is not a drop-in for `bun run test`.

```bash
bun run dev            # Start dev server (Turbopack)
bun run build           # Production build
bun run start            # Serve production build
bun run test              # Run all Jest tests
bun run lint               # ESLint (flat config)
bunx jest __tests__/unit/lib/ratelimit.test.ts   # Single test file
```

`bun run test:unit` / `bun run test:integration` are broken (`--selectProjects` with no `projects` defined in `jest.config.ts`) — use `bun run test` or a path filter instead. See "Known Issues" in `AGENTS.md` for other pre-existing failures (stale test fixtures, lint errors) that predate any change you make.

## Architecture

Three subsystems share one Next.js 16 (App Router) + React 19 codebase:

1. **Editor** (`app/editor/[id]/`, `components/Editor.tsx`) — student prompts hit `POST /api/generate`, which streams from DeepSeek (`lib/gemini.ts` — despite the filename, no Gemini code) and renders into a sandboxed `srcdoc` iframe (`components/Preview.tsx`). Build mode is server-gated: granted only if `user_build_mode.enabled` is true *and* the project has no pending core/homework task.
2. **Lessons** (`app/lessons/`, `lib/lessons.ts`, `lib/task-checks.ts`, `public/templates/`) — weekly lessons with code-aware task verification (checks run against the student's live file, not self-reported) and gated homework.
3. **Admin back office** (`app/admin/`, `app/api/admin/`, `components/admin/`) — students, classes, homework review, invoices/receipts. Middleware only guards page navigation; every admin API route independently re-checks `ADMIN_EMAILS`.

**Supabase has three clients with different privileges**: `createBrowserSupabaseClient()` (anon, Client Components), `createServerSupabaseClient()` (anon + cookies, identifies the caller, respects RLS), and `supabaseAdmin` (service role, bypasses RLS — used for nearly all reads/writes). Because `supabaseAdmin` ignores RLS, every query must carry its own ownership check (e.g. `.eq('id', id).eq('user_id', user.id)`). Never import `supabaseAdmin` into a Client Component.

**Drizzle (`lib/db/client.ts`, `lib/db/schema.ts`)** is available for new server-side code as a typed alternative to `supabaseAdmin` — same service-role Postgres connection, same RLS-bypass, same per-query ownership-check obligation. It's database-first: `supabase/migrations/*.sql` is still the schema source of truth; run `bun run db:pull` to re-introspect `lib/db/schema.ts` after a migration. Existing `supabaseAdmin` call sites have not been migrated — this is additive, not a replacement.

**The LLM contract is delimiter-based and full-file**: build responses are `--- FILE: <name> ---` ... `--- DONE ---` blocks parsed by `lib/parse-multi-file.ts`; files are replaced wholesale, never diffed. Model is pinned to `deepseek-v4-flash` via the native DeepSeek API for cost control — don't change providers/models without approval.

**Preview is `srcdoc`-only, deliberately** — no WebContainer, Sandpack, or CodeSandbox SDK.

**Path alias**: `@/` maps to the repo root (kept in sync between `tsconfig.json` and `jest.config.ts`).

**Next.js 16 specifics**: `params` in pages/route handlers is a `Promise` and must be awaited; `createServerSupabaseClient()` is async (`cookies()` is async) and must be awaited.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only
DATABASE_URL=                    # server-side only; Postgres pooler URL for Drizzle, bypasses RLS like supabaseAdmin
DEEPSEEK_API_KEY=                # server-side only
ADMIN_EMAILS=                    # comma-separated; grants back-office access + bypasses rate limit
TELEGRAM_BOT_TOKEN=              # server-side only
```

## Key Constraints

- Rate limit: 20 prompts/hour/user (`lib/ratelimit.ts`), fails open on query errors, admins bypass.
- All DB writes go through server-side routes using `supabaseAdmin`; never expose the service role key or DeepSeek/Telegram tokens to the browser.
- Lesson versioning uses parallel catalogs (`lib/lessons.ts`), not migrations — never edit an old catalog in place, add a new one and bump the version.
