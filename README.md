# SparkBuild — Student Code Builder

**Build the future, one line at a time.**

SparkBuild is an AI-assisted Python platform for students aged 11–16. Students work through a
weekly course on a shared board with **Spark**, an AI tutor that talks in short captions,
draws on the board and nudges instead of solving — so what they write is actually theirs.
Python runs in the browser. Every task is verified by code, and progress earns XP, levels, badges
and a daily streak. Teachers and admins run classes and deliver invoices and receipts to parents
over Telegram from one back office.

![SparkBuild landing page](docs/screenshots/landing.png)

## Features

- **Tutor board** — one page per task; Spark speaks in captions and edits the board with tools
  (code nodes, quizzes, variable diagrams, step-by-step traces). Code runs in a Pyodide worker.
- **Verified lessons** — each task carries checks that run against the student's live code in
  the browser and are re-verified on the server; a task completes itself when the checks pass.
  Core tasks are required; choice and bonus tasks are optional extras that unlock alongside them.
- **Game layer** — XP per task, seven levels, a badge per lesson boss, and a streak.
- **Staff back office** — students, classes with weekly schedules, per-class lesson unlocking,
  invoices/receipts sent over Telegram, role management.

## Tech stack

| Layer              | Technology                                            |
| ------------------ | ----------------------------------------------------- |
| Framework          | Next.js 16 (App Router) + React 19, TypeScript        |
| Styling            | Tailwind CSS 3, shadcn/ui (`base-nova`)               |
| Editor             | CodeMirror 6 (Python)                                 |
| Auth               | Better Auth with Google sign-in                       |
| Database           | Postgres 17 via Drizzle ORM + node-postgres           |
| Cache / rate limit | Redis via ioredis (optional)                          |
| AI                 | DeepSeek `deepseek-v4-flash` through the `openai` SDK |
| Python runtime     | Pyodide 0.27 in a Web Worker (browser only)           |
| Messaging          | Telegram Bot API                                      |
| Testing / lint     | Jest 30 + Testing Library, ESLint 9 (flat config)     |

## Getting started

### Prerequisites

- [bun](https://bun.sh) (the repo ships `bun.lock`)
- Postgres 17 (any Postgres works; 17 matches production)
- Redis — optional; without it there is no caching or rate limiting
- A Google OAuth client (Google Cloud Console → APIs & Services → Credentials)
- A DeepSeek API key

### Install

```bash
git clone https://github.com/thymadona/Sparkbuild-AI-agent.git
cd Sparkbuild-AI-agent
bun install
cp .env.local.example .env.local   # then fill in the values below
```

### Environment variables

`.env.local.example` documents every variable in detail; summary:

| Variable                                   | Purpose                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | The app's only database connection; also the target of `db:migrate` / `db:studio`                        |
| `TEST_DATABASE_URL`                        | Separate **local** database for Jest — must differ from `DATABASE_URL`                                   |
| `BETTER_AUTH_SECRET`                       | `openssl rand -base64 32`                                                                                |
| `BETTER_AUTH_URL`                          | The app's own origin; the Google redirect URI is `<BETTER_AUTH_URL>/api/auth/callback/google`            |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client                                                                                      |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME`      | Used once by `bun run db:seed:admin` to create the first admin                                           |
| `DEEPSEEK_API_KEY`                         | DeepSeek API                                                                                             |
| `TELEGRAM_BOT_TOKEN`                       | Invoice / receipt delivery                                                                               |
| `NEXT_PUBLIC_SITE_URL`                     | Public site URL                                                                                          |
| `REDIS_URL`                                | Optional. `redis://` locally, `rediss://` in production (Upstash: the Redis-protocol endpoint, not REST) |
| `TEST_REDIS_URL`                           | Used when `NODE_ENV=test`; defaults to `redis://127.0.0.1:6379/15`                                       |
| `APP_TIMEZONE`                             | Optional IANA zone for the streak's day boundary; default UTC                                            |

### Database

```bash
createdb spark_build && bun run db:migrate          # apply the full migration history
createdb spark_build_test && bun run db:migrate:test # test database (Jest also does this)
bun run db:seed:admin                                # first admin, claimed by Google sign-in on that email
```

Schema lives in `lib/db/schemas/*.ts`; migrations in `drizzle/`. To change it: edit the table
file, `bun run db:generate`, `bun run db:migrate`. See `drizzle/README.md`.

### Run

```bash
bun run dev      # http://localhost:3000
bun run build && bun run start
```

## Scripts

| Command                                  | Description                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `bun run dev`                            | Development server (Turbopack)                                                                       |
| `bun run build` / `bun run start`        | Production build / serve                                                                             |
| `bun run test`                           | All Jest tests (real Postgres; sets `NODE_OPTIONS=--experimental-vm-modules` for the Pyodide suites) |
| `bun run lint`                           | ESLint                                                                                               |
| `bun run format` / `format:check`        | Prettier write / check (the check runs in CI)                                                        |
| `bun run db:generate`                    | Derive migration DDL from `lib/db/schemas/*.ts` into `drizzle/`                                      |
| `bun run db:migrate` / `db:migrate:test` | Apply `drizzle/` to `DATABASE_URL` / `TEST_DATABASE_URL`                                             |
| `bun run db:studio`                      | Drizzle Studio                                                                                       |
| `bun run db:seed:admin`                  | Seed the superadmin                                                                                  |

`test:unit` and `test:integration` are currently broken (no Jest `projects` defined) — use
`bun run test` or a path filter. One file:

```bash
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/xp.test.ts
```

## Project structure

```
app/
├── board/[id]/       Student workspace: server page + LiveBoard client (the tutor board)
├── lessons/          Lesson roadmap and detail pages
├── dashboard/        Student home
├── staff/            Back office (overview, classes, students, finance, telegram, users)
├── admin/, teacher/  Redirect shells into /staff
├── invoice/[id]/, receipt/[id]/   Link-based views sent to parents
├── login/, register/, no-class/, profile/, about/
└── api/
    ├── auth/[...all]/            Better Auth (incl. the Google callback)
    ├── projects/                 Project CRUD, autosave, lesson progress, tutor turn
    ├── admin/                    Classes, students, invoices, schedules, telegram, roles
    └── profile/
components/           Reusable UI (ui/ primitives, admin/, dashboard/, CodeEditor, PlayerCard…)
hooks/                Python runner, task checks, auto-complete, lesson progress
lib/
├── auth/             Better Auth config, session, permissions, route-guard logic
├── board/            Board schema, tools, reducer, code projection, task pages
├── tutor/            System prompt, client events, the turn loop
├── db/               Drizzle client, schemas/ (one table per file), uuid guard
├── lessons.ts, py-lessons.ts, task-checks.ts, task-verify.ts, task-guard.ts
├── xp.ts, player-stats.ts, lesson-availability.ts, ratelimit.ts, cache.ts, redis.ts
└── deepseek.ts, sparky-events.ts, python-checks.ts, schedule.ts, utils.ts
public/
├── py-worker.js, py-runtime.py    Pyodide worker and the `sparky` runtime module
└── templates/py/                  Lesson starter files (w1.py, w1-bugzap.py, …)
drizzle/              Migrations (schema of record) and snapshots
proxy.ts              Route guard (Next 16 Proxy)
types/index.ts        Shared row types
__tests__/            unit/ and integration/ (mirrors the source), fixtures/, helpers/
```

## Testing

Tests hit a real Postgres (`TEST_DATABASE_URL`) that Jest migrates before the run and
truncates between tests; only external services (DeepSeek, Telegram) are mocked. The default
environment is Node — component tests start with `/** @jest-environment jsdom */`. Some suites
load real Pyodide under Node, which is why `bun run test` sets `--experimental-vm-modules`.

## Working on the code with Claude Code

`CLAUDE.md` holds the rules; `.claude/skills/` holds one skill per subsystem (database, auth,
roles, tutor, lesson progress, lesson authoring, XP/streak, architecture) that Claude loads on
demand.

## License

Private — not licensed for redistribution.
