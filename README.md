# Student Code Builder

An AI-assisted coding platform for students aged 10–16. Students follow a 6-week lesson track building real websites — personal pages, interactive games, data-driven tools — with an AI tutor that guides instead of solving. Teachers manage classes, review homework, and communicate with parents through an admin back office.

## Features

**Student Editor** — prompt-driven workspace where students type what they want to build and see a live HTML preview in a sandboxed iframe. Two modes: *ask* (the AI tutors) and *build* (the AI generates code). Build mode is server-gated behind task completion.

**Guided Lessons** — 6 weekly lessons with structured tasks, automated code checks, and homework. Task verification is code-aware (checks run against the student's live file), so progress can't be self-reported past the system.

**Admin Back Office** — manage students, classes with weekly schedules, invoices/receipts delivered over Telegram, homework review with mandatory feedback, and per-student build-mode control.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 |
| UI Components | shadcn/ui (base-nova style) |
| Editor | CodeMirror 6 |
| Auth & Database | Supabase (Auth + Postgres + RLS) |
| AI | DeepSeek v4-flash via OpenAI SDK |
| Testing | Jest 30 + Testing Library |
| Linting | ESLint 9 (flat config) |

## Getting Started

### Prerequisites

- Node.js 20+
- [bun](https://bun.sh)
- A Supabase project
- A DeepSeek API key

### Installation

```bash
git clone <repo-url>
cd student-code-builder
bun install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Scope | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon/public key |
| `NEXT_PUBLIC_SITE_URL` | Client + Server | Your deployment URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (bypasses RLS) |
| `DEEPSEEK_API_KEY` | Server only | DeepSeek API key |
| `ADMIN_EMAILS` | Server only | Comma-separated admin email addresses |
| `TELEGRAM_BOT_TOKEN` | Server only | Telegram bot token for invoice delivery |

### Database Setup

Apply migrations in order from `supabase/migrations/`:

```bash
supabase db push
```

Or apply them manually against your Supabase project's SQL editor.

### Development

```bash
bun run dev
```

The app starts at `http://localhost:3000`. Authenticated users are redirected to `/dashboard`; unauthenticated users land on `/login`.

### Production Build

```bash
bun run build
bun run start
```

## Project Structure

```
app/
├── api/              Route handlers (generate, projects, admin, settings)
├── editor/[id]/      Student workspace (server page + EditorLayout client)
├── lessons/          Lesson catalog and individual lesson pages
├── admin/            Back office (students, classes, finance, homework, telegram)
├── dashboard/        Student project list
├── explore/          Public project gallery
├── share/[id]/       Public share page (no auth required)
├── invoice/[id]/     Invoice view (link-based access)
├── receipt/[id]/     Receipt view (link-based access)
├── auth/callback/    OAuth callback
└── login/, register/, about/, profile/

components/
├── ui/               shadcn primitives (Button, DropdownMenu)
├── admin/            Admin modals and action buttons
├── Editor.tsx        Main editor orchestration
├── CodeEditor.tsx    CodeMirror wrapper
├── Preview.tsx       Sandboxed iframe preview
├── Navigator.tsx     Lesson task panel
└── ...

lib/
├── supabase-server.ts   Server client (anon + cookies) & admin client (service role)
├── supabase-browser.ts  Browser client (anon)
├── gemini.ts            DeepSeek client + system prompts
├── lessons.ts           Lesson catalog with task definitions
├── task-checks.ts       Automated task verification logic
├── task-guard.ts        Build-mode gating (pendingCoreTask)
├── parse-multi-file.ts  LLM response delimiter parser
├── combine.ts           HTML/CSS/JS inliner for preview
├── ratelimit.ts         Per-user prompt rate limiting
├── schedule.ts          Class scheduling utilities
└── utils.ts             cn() and shared helpers

types/index.ts           Shared TypeScript interfaces
supabase/migrations/     Schema of record (SQL)
public/templates/        Lesson starter HTML files
__tests__/               Unit and integration tests
middleware.ts            Session refresh, route guards, admin gate
```

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start development server (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Serve production build |
| `bun run test` | Run all Jest tests |
| `bun run lint` | Run ESLint |

Run a single test file:

```bash
bunx jest __tests__/unit/lib/ratelimit.test.ts
```

## Architecture Notes

- **Auth**: Supabase Auth with OAuth. Middleware refreshes sessions and guards `/dashboard`, `/editor`, `/profile`, and `/admin` routes.
- **Admin access**: Controlled by the `ADMIN_EMAILS` environment variable. Each admin API route re-verifies authorization independently.
- **LLM pipeline**: `POST /api/generate` streams responses from DeepSeek. Build-mode responses use a `--- FILE: name ---` / `--- DONE ---` delimiter format parsed by `lib/parse-multi-file.ts`.
- **Preview**: Pure `srcdoc` iframe with `sandbox="allow-scripts allow-forms"`. No external sandbox runtime. A console interceptor script is injected for error reporting.
- **Autosave**: The editor writes to `/api/projects` after 1200ms of idle time. No manual save button for lesson projects.
- **Rate limiting**: 20 prompts per hour per user. Fails open on query errors. Admins bypass.
- **Lesson versioning**: Parallel catalogs, not migrations. Old projects keep their task IDs intact.

## Testing

Tests live in `__tests__/unit/` and `__tests__/integration/`, mirroring the source tree. Component tests that need a DOM require a jsdom docblock:

```ts
/** @jest-environment jsdom */
```

The default test environment is Node.

## License

Private — not licensed for redistribution.
