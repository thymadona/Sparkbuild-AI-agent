# CLAUDE.md

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
2. Route authenticates via Supabase server client, checks rate limit (20/day/user)
3. Prompt logged to `prompts` table, then streamed to OpenRouter (Gemini 2.5 Flash)
4. Response streamed back to client via `ReadableStream` + `TextEncoder`
5. On stream completion, final HTML saved to `projects.files` JSONB column

### Three Supabase Clients (`lib/supabase.ts`)

- `createBrowserSupabaseClient()` — Client Components, uses anon key
- `createServerSupabaseClient()` — Server Components/API routes, respects RLS, uses cookies
- `supabaseAdmin` — Server-only, bypasses RLS with service role key. All DB writes use this.

### Auth & Middleware (`middleware.ts`)

Supabase middleware refreshes session on every request. Protected routes: `/dashboard`, `/editor`. Excluded from middleware: `/auth/callback`, `/share`.

### LLM Integration (`lib/gemini.ts`)

Uses `openai` SDK pointed at OpenRouter's base URL. System prompt forces raw HTML output (no markdown, no code fences). Model constant: `google/gemini-2.5-flash-preview`.

### Preview Rendering

Always `<iframe srcdoc={code}>` — never blob URLs. If generated output doesn't start with `<!DOCTYPE html>`, show error state. Full file replacement on each generation (no diffs/patches).

### Path Aliases

`@/` maps to project root (configured in tsconfig and jest).

## Data Models (Supabase)

- `projects`: id, user_id, title, `files` (JSONB: `{ "index.html": "..." }`), is_public, timestamps
- `prompts`: id, user_id, project_id, content, created_at

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only
OPENROUTER_API_KEY=              # server-side only
```

## Key Constraints

- Model: `google/gemini-3-flash-preview` via OpenRouter -- do not switch without approval (cost control)
- Do not install WebContainer, Sandpack, or CodeSandbox SDK -- srcdoc is intentional
- All DB writes go through server-side routes using `supabaseAdmin`
- Never expose service role key to the browser
- MVP: single HTML file only, no multi-file, no version history, no payments
