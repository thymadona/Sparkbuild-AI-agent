# CLAUDE.md

**Keep in mind when u build it** when i build a new thing, i prefer reasoning from atomic level only the most fundamental things ignored good to have basically first principles inspired by Elon Musk

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A Lovable-style AI code generation app for 200-500 students. User types a prompt, LLM generates a single HTML file, live preview in iframe. Projects are saved and shareable. Optimized for near-zero infra cost.

## Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run lint         # ESLint
bun run test         # All tests
bun run test:unit    # Unit tests only
bun run test:integration  # Integration tests only
bunx jest __tests__/unit/lib/ratelimit.test.ts  # Single test file
```

## Stack

- **Framework**: Next.js 14 (App Router)
- **Hosting**: Vercel (free tier)
- **Auth + DB**: Supabase (magic link auth, Postgres)
- **LLM**: Gemini 3 Flash Preview via OpenRouter (`openai` SDK, OpenAI-compatible)
- **Code Preview**: `srcdoc` iframe (no sandbox service, no WebContainer)
- **Styling**: Tailwind CSS
- **Testing**: Jest with @testing-library/react

## Architecture

### Request Flow

1. User prompt hits `POST /api/generate`
2. Route authenticates via Supabase server client, checks rate limit (20/hour/user; admins bypass via `ADMIN_EMAILS` env var)
3. Prompt logged to `prompts` table, then streamed to OpenRouter (Gemini 2.5 Flash)
4. Response streamed back to client via `ReadableStream` + `TextEncoder`
5. On stream completion: if build mode, parse files and update `projects.files`; persist both user and assistant messages to `messages` table

### Three Supabase Clients

- `lib/supabase-browser.ts`: `createBrowserSupabaseClient()` — Client Components, uses anon key
- `lib/supabase-server.ts`: `createServerSupabaseClient()` — Server Components/API routes, respects RLS, uses cookies; `supabaseAdmin` — Server-only, bypasses RLS with service role key. All DB writes use this.

### Auth & Middleware (`middleware.ts`)

Supabase middleware refreshes session on every request. Protected routes: `/dashboard`, `/editor`. Excluded from middleware: `/auth/callback`, `/share`.

### LLM Integration (`lib/gemini.ts`)

Uses `openai` SDK pointed at OpenRouter's base URL. Two system prompts: `ASK_SYSTEM_PROMPT` (tutoring, never writes code) and `BUILD_SYSTEM_PROMPT` (generates HTML using `--- FILE: index.html ---` / `--- DONE ---` delimiters). Model constant: `google/gemini-3-flash-preview`.

Build mode is off by default; enabled per-user via the `user_build_mode` table. The server is authoritative — client sends `mode: 'build'` but server verifies the user's permission before using `BUILD_SYSTEM_PROMPT`.

### Preview Rendering

Always `<iframe srcdoc={code}>` — never blob URLs. Files are parsed from LLM output via `lib/parse-multi-file.ts` using `--- FILE: <name> ---` / `--- DONE ---` delimiters. `parseSummary()` extracts the friendly message after `--- DONE ---` to show in chat instead of raw LLM output. Full file replacement on each generation (no diffs/patches).

### Path Aliases

`@/` maps to project root (configured in tsconfig and jest).

## Data Models (Supabase)

- `projects`: id, user_id, title, `files` (JSONB: `{ "index.html": "..." }`), is_public, timestamps
- `prompts`: id, user_id, project_id, content, created_at — also used as the rate limit log
- `messages`: id, project_id, user_id, role (`user`|`assistant`), content, created_at — full chat history per project
- `user_build_mode`: user_id, enabled (bool) — controls whether build mode is accessible

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only
OPENROUTER_API_KEY=              # server-side only
ADMIN_EMAILS=                    # comma-separated; bypasses rate limit
```

## Key Constraints

- Model: `google/gemini-3-flash-preview` via OpenRouter — do not switch without approval (cost control)
- Rate limit: 20 prompts/hour/user; controlled in `lib/ratelimit.ts`; `ADMIN_EMAILS` env var bypasses it
- Do not install WebContainer, Sandpack, or CodeSandbox SDK -- srcdoc is intentional
- All DB writes go through server-side routes using `supabaseAdmin`
- Never expose service role key to the browser
- MVP: single HTML file only, no multi-file, no version history, no payments
