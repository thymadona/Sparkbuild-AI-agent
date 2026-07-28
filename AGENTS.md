# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 14 App Router application. Route pages, layouts, and API handlers live in `app/`; keep route-specific client components beside their route (for example, `app/editor/[id]/EditorLayout.tsx`). Reusable UI belongs in `components/`, with primitives in `components/ui/`. Shared utilities live in `lib/`, and shared TypeScript types in `types/`.

Tests mirror the implementation area under `__tests__/unit/` and `__tests__/integration/`. Put Supabase schema changes in `supabase/migrations/` using dated, descriptive SQL filenames such as `20260329_cascade_user_deletes.sql`. Static templates and assets belong in `public/`.

## Build, Test, and Development Commands

- `npm run dev` starts the local Next.js development server.
- `npm run build` creates a production build; run it before submitting changes that affect routes or configuration.
- `npm run start` serves a completed production build.
- `npm test` runs the Jest suite.
- `npx jest __tests__/unit/lib/ratelimit.test.ts` runs one focused test file.
- `npm run lint` runs the configured Next.js ESLint command.

Use `npm` for reproducible installs because the repository includes `package-lock.json`.

## Coding Style & Naming Conventions

Write TypeScript with the existing style: two-space indentation, single quotes, omitted semicolons, and strict types. Prefer the `@/` alias for root imports. Name React components in PascalCase (`ProfileDropdown.tsx`), utilities in camelCase (`parse-multi-file.ts`), and route handlers `route.ts`. Keep Client Components explicit with `'use client'`; do not move server-only logic into them.

Tailwind CSS is the styling system. Reuse `cn()` from `lib/utils.ts` for conditional class names and existing `components/ui` primitives before adding duplicate UI patterns.

## Testing Guidelines

Jest is configured through `jest.config.ts` with Testing Library support. Name tests `*.test.ts` or `*.test.tsx` and place them under the matching `__tests__/unit/` or `__tests__/integration/` area. Test observable behavior, mock external Supabase/LLM dependencies, and cover error paths for API and persistence logic. Run relevant focused tests during development, then `npm test` before opening a pull request.

## Commit & Pull Request Guidelines

Follow the history’s concise imperative style, preferably Conventional Commits: `feat(admin): add class schedule editor`, `fix: enforce rate limit`, or `refactor: simplify editor state`. Keep each commit focused. Pull requests should explain the user-facing change, note migrations or environment-variable changes, link the related issue when available, and include screenshots for visible UI changes.

## Security & Configuration

Keep `SUPABASE_SERVICE_ROLE_KEY` and `DEEPSEEK_API_KEY` server-only; only `NEXT_PUBLIC_*` values may reach the browser. Use the Supabase server/admin clients only from server code, preserve RLS expectations, and never commit local environment files or secrets.
