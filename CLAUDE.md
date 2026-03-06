# CLAUDE.md — Student Code Builder (Lovable Clone)

## What This Project Is

A Lovable-style AI code generation app for 200–500 students. User types a prompt → LLM generates a single HTML file → live preview in iframe. Projects are saved and shareable. Optimized for near-zero infra cost.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Hosting**: Vercel (free tier)
- **Auth + DB**: Supabase (magic link auth, Postgres)
- **LLM**: Google Gemini 2.0 Flash via `@google/generative-ai`
- **Code Preview**: `srcdoc` iframe (no sandbox service, no WebContainer)
- **Styling**: Tailwind CSS

## Project Structure

```
/app
  /api
    /generate      → Gemini streaming API route
    /projects      → CRUD for saved projects
  /dashboard       → User's saved projects
  /editor/[id]     → Main editor + preview page
  /auth            → Magic link callback
/components
  /Editor          → Prompt input + chat history
  /Preview         → srcdoc iframe renderer
  /FileTree        → Project file state display
/lib
  /gemini.ts       → Gemini client + system prompt
  /supabase.ts     → Supabase client (server + browser)
  /ratelimit.ts    → Per-user daily prompt counter
/types
  index.ts         → Shared TypeScript types
```

## Core Data Models (Supabase)

```sql
-- users handled by Supabase Auth

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default 'Untitled',
  files jsonb not null default '{}',   -- { "index.html": "..." }
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  project_id uuid references projects,
  content text not null,
  created_at timestamptz default now()
);
```

## LLM System Prompt (in /lib/gemini.ts)

```
You are a code generator for students learning to build web apps.
Always return a SINGLE complete HTML file with all CSS in a <style> tag 
and all JavaScript in a <script> tag. No markdown. No explanation. 
No code fences. Return raw HTML only starting with <!DOCTYPE html>.
When editing existing code, return the full updated file, not a diff.
```

## Rate Limiting Rule

- **20 prompts per user per 24 hours** — hard cap, no exceptions
- Check before every `/api/generate` call
- Query: `SELECT COUNT(*) FROM prompts WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`
- Return HTTP 429 with message `"Daily limit reached. Resets in X hours."` if exceeded

## Preview Rendering Rule

- Always render in `<iframe srcdoc={code} sandbox="allow-scripts allow-forms" />`
- Never use `src` with a blob URL — `srcdoc` only
- On each new generation, replace the entire srcdoc (full file, not patch)
- If the generated string does not start with `<!DOCTYPE html>`, do not render — show an error state

## Streaming Pattern

```ts
// /app/api/generate/route.ts
export async function POST(req: Request) {
  // 1. Auth check — reject if no session
  // 2. Rate limit check — reject if over 20/day
  // 3. Log prompt to DB
  // 4. Stream Gemini response back as text/event-stream
  // 5. On stream end, update project files in DB
}
```

Use `ReadableStream` + `TextEncoder` for streaming. Do not buffer the full response before sending.

## File State Shape (in-memory + DB)

```ts
type ProjectFiles = Record<string, string>
// e.g. { "index.html": "<!DOCTYPE html>..." }
// MVP only needs one key. Multi-file support comes later.
```

## Auth Rules

- Magic link only (no passwords — reduces friction for students)
- Protect all `/dashboard` and `/editor` routes via Supabase middleware
- Public projects (`is_public: true`) are readable without auth via `/share/[id]`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never expose to client
GEMINI_API_KEY=
```

## What NOT to Build (MVP Scope Guard)

- No multi-file tabs (single HTML file only)
- No terminal / npm install / Node runtime
- No collaborative editing
- No version history (just latest save)
- No payments / tiers
- No custom domains for previews

## Key Constraints

- Gemini 2.0 Flash only — do not switch models without approval (cost control)
- Do not install WebContainer, Sandpack, or CodeSandbox SDK — srcdoc is intentional
- All DB writes go through server-side routes using `SUPABASE_SERVICE_ROLE_KEY`
- Never expose service role key to the browser

## Done = Definition

A session is complete when: user can log in → type a prompt → see live HTML preview → save project → reload page and see saved project → share via URL.
