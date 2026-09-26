---
name: auth-flow
description: How authentication works end to end — Better Auth (not Supabase) with Google as the only provider (`lib/auth/index.ts`), `getSessionUser()` in `lib/auth/session.ts`, `authClient` in `lib/auth/client.ts`, the sign-in/callback sequence, `ensureStudentDefaults` (auto student profile + role), the `proxy.ts` route guard and `lib/auth/guard.ts` `decideGuard` precedence (login, paused org, `/console`, deactivated, `/admin`, `/teacher`, `/staff`), and `bun run db:seed:admin`. Use for anything mentioning auth, authentication, login, sign in, sign out, session, cookie, Google OAuth, Better Auth, callback, redirect_uri_mismatch, getSessionUser, authClient, useSession, proxy.ts, middleware, route guard, deactivated account, suspended/paused org, /paused, /console guard, cookie cache, student profile, superadmin. Use this before exploring `lib/auth/`, `proxy.ts`, `app/login`, `app/api/auth` — it already maps them.
---

# Authentication: Better Auth + Google

The app talks to Google directly; there is no Supabase Auth and no `middleware.ts`.

## Files

| Path                                          | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/auth/index.ts`                           | `export const auth = betterAuth({...})` — the whole server config (below).                                                                                                                                                                                                                                                                                                                                                                                               |
| `lib/auth/session.ts`                         | `getSessionUser(): Promise<{ id, email, name, orgId } \| null>` — wrapped in React `cache()`; calls `auth.api.getSession({ headers })`, which reads the session **and its user row** (so `orgId`) from Postgres on every call (cookie is not trusted). Returns **null for a member of a suspended org** (`isSuspendedFor`; fails closed for schools, no query for Direct, `platform_admin` exempt). The one way to read the caller in pages, layouts and route handlers. |
| `lib/auth/client.ts`                          | `'use client'`; `authClient = createAuthClient()` (same origin), re-exports `signIn`, `signOut`, `useSession`. Consumers: `app/LoginForm.tsx` (sign-in), `components/ProfileDropdown.tsx` (sign-out). `useSession` is unused.                                                                                                                                                                                                                                            |
| `lib/auth/student-defaults.ts`                | `ensureStudentDefaults(userId, name)` — see below.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lib/auth/guard.ts`                           | Pure `decideGuard(input): { redirect, params? }                                                                                                                                                                                                                                                                                                                                                                                                                          | null`; no DB, unit-tested directly. |
| `proxy.ts`                                    | Next 16 Proxy (Node runtime — setting `runtime` throws). Gathers facts from the DB, calls `decideGuard`, redirects. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, **`api/auth`** (so the OAuth callback completes without a session).                                                                                                                                                                                                                   |
| `app/api/auth/[...all]/route.ts`              | `toNextJsHandler(auth)` — serves `/api/auth/sign-in/social`, `/api/auth/callback/google`, `/api/auth/sign-out`, `/api/auth/get-session`, …                                                                                                                                                                                                                                                                                                                               |
| `app/login/page.tsx`, `app/register/page.tsx` | Server pages; both render `app/LoginForm.tsx`; redirect to `/lessons` when already signed in; `/login?reason=deactivated` shows a banner.                                                                                                                                                                                                                                                                                                                                |
| `scripts/seed-superadmin.ts`                  | `bun run db:seed:admin`: finds/creates a `users` row in Direct for `SUPERADMIN_EMAIL` (`emailVerified: true`, no credential) and grants Direct `admin` plus the org-less `platform_admin` (which opens `/console`). Idempotent. The person claims it by signing in with Google on that address.                                                                                                                                                                          |
| `lib/auth/permissions.ts`                     | Roles/permissions — see the `roles-permissions` skill.                                                                                                                                                                                                                                                                                                                                                                                                                   |

## `lib/auth/index.ts` config (every line is load-bearing)

- `database: drizzleAdapter(db, { provider: 'pg', schema: { users, sessions, accounts, verifications } })` — keys are the plural model names.
- `user/session/account/verification: { modelName: 'users' | 'sessions' | ... }` and **no `fields` maps**: Better Auth resolves each field by its _Drizzle property name_, and the schema's camelCase properties match its field names exactly. Renaming a property on those four tables breaks sign-in at runtime with no compile error.
- `account.accountLinking: { enabled: true, trustedProviders: ['google'] }` — admin-provisioned students (and the seeded superadmin) exist as credential-less `users` rows; Google sign-in on the matching verified email links to that row instead of creating a duplicate.
- `socialProviders.google` from `GOOGLE_CLIENT_ID/SECRET`. `baseURL` = `BETTER_AUTH_URL` (the OAuth redirect is built from it; wrong value → Google `redirect_uri_mismatch`). Authorized redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`.
- `advanced.database.generateId: () => crypto.randomUUID()` — ids are uuid, not Better Auth's text default.
- `databaseHooks.user.create.after` and `databaseHooks.session.create.after` both call `ensureStudentDefaults` (so it runs on first sign-up _and_ every later sign-in).
- Session expiry: Better Auth defaults. **No `session.cookieCache`**: with a database adapter Better Auth leaves it off, so `getSession` reads the user (and `orgId`) fresh on every call and an org move (`lib/org-move.ts`) or suspension applies on the next request. Enabling it would serve a stale `orgId` for up to its `maxAge` — don't, without re-reading `orgId` in `getSessionUser`.
- `user.additionalFields.orgId` (`input: false`) is what puts `orgId` on the session user.

## Sign-in sequence

1. `/login` → `LoginForm` → `authClient.signIn.social({ provider: 'google', callbackURL: '/lessons' })` → POST `/api/auth/sign-in/social` → redirect to Google.
2. Google → `/api/auth/callback/google` (proxy skips it).
3. Better Auth finds or links the `accounts` row; creates `users` if new → `user.create.after` → `ensureStudentDefaults`.
4. `sessions` row inserted → `session.create.after` → `ensureStudentDefaults` again (idempotent).
5. Redirect to `/lessons` → `proxy.ts` runs the guard below.

`ensureStudentDefaults(userId, name)`: returns early if the user holds `admin` or `teacher`;
otherwise in one transaction upserts `student_profiles { userId, fullName }` and
`user_roles { userId, roleId(student), grantedBy: null }` (both `onConflictDoNothing`). Wrapped
in try/catch — it can never block a sign-in. The `student` role has zero permissions; it is an
identity marker (`roles-permissions`).

## Route guard (`proxy.ts` → `decideGuard`)

Facts gathered per request (only when relevant to the path):

- `/lessons`, `/board`, `/profile` ("protected"): `student_profiles.is_active` only.
  `isDeactivated = profile exists && is_active === false`. Fails open on a DB error. No class is
  needed: a new student lands on `/lessons` with the first lesson open (B2C self-paced access,
  `lib/lesson-availability.ts`; the old `/no-class` page is gone).
- `/admin`, `/teacher`, `/staff`: `queryIsAdmin(user)` and `queryCanAccessTeacherDashboard(user)` (`lib/auth/permissions.ts`, uncached) (admin-inclusive). **Fail closed** (`=== true` only).
- `/console`: `queryIsPlatformAdmin(user)`, fail closed.
- Every signed-in request (pages **and** `/api/*`): `isSuspendedFor(user.id, user.orgId)`, fail
  closed (a failed check pauses a school user; Direct never queries). A paused user's `/api/*`
  call is answered 403 by `proxy.ts` itself.

`decideGuard` precedence:

1. No user on any of the above paths (incl. `/console`) → `/login`.
2. Suspended org → `/paused` (except `/paused` and `/login`).
3. `/console` and not platform admin → `/lessons`.
4. Protected + deactivated → `/login?reason=deactivated`.
5. `/admin` and not admin → `/lessons`.
6. `/teacher` or `/staff` and no teacher access → `/lessons`.

A missing `student_profiles` row means "not a student" and passes (staff accounts typically
have none).

The guard only covers **page navigation**. Every API route re-authenticates with
`getSessionUser()` (→ 401) and re-authorizes itself (`roles-permissions`).

## Gotchas / stale comments

- `proxy.ts` comment names an `ensureStudentProfile` hook — the function is `ensureStudentDefaults` in `lib/auth/student-defaults.ts`.
- `.env.local.example` mentions reusing the Google client "pasted into the Supabase dashboard" — historical; only the redirect URI matters now.
- `useSession` is exported from `lib/auth/client.ts` but nothing uses it; server code always goes through `getSessionUser()`.

## Tests

- `__tests__/unit/lib/guard.test.ts` — `decideGuard` precedence (incl. paused and `/console`).
- `__tests__/integration/session-suspension.test.ts` — `getSessionUser` returns null for a paused school, never for Direct.
- `__tests__/unit/lib/student-defaults.test.ts` — profile + role upsert, skips staff, never throws.
- Integration suites mock the session (`jest.mock('@/lib/auth/session', () => ({ getSessionUser: ... }))`,
  see `__tests__/integration/api/projects.test.ts`) and create users with `makeUser`/`grantRole`
  from `__tests__/helpers/db.ts`; Google is never called.
