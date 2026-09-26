# D1 — Organizations: requirements

## Scope

- An `organizations` table. The migration seeds one row, SparkBuild Direct (slug `app`), the
  B2C org.
- `org_id` on the root tenant tables only: `users`, `classes`, `invoices`, `receipts`, plus
  `user_roles` for per-org roles. Every existing row is backfilled to Direct.
- Per-org roles: `admin` and `teacher` mean admin/teacher **of that org**. A new org-less
  `platform_admin` role marks the platform owner.
- Every staff query carries an org predicate; cross-org reads return 404 and cross-org writes
  are refused.
- A hard rule in `CLAUDE.md`, next to the ownership-predicate rule.

## Non-goals

- No subdomains, host → org or sign-in changes (D2). Every new user joins Direct.
- No new dashboard or UI to create/switch orgs (D3, D9). `/staff` looks the same, scoped to
  the viewer's org.
- No cross-org powers for `platform_admin` yet; it is a marker the D9 console will use.
- No `org_id` on child tables (projects, progress, members, schedules, enabled lessons,
  messages, activity days, student profiles). They reach the org through their user or class.
- The lesson catalog, `prompts` and `app_settings` stay global.

## Decisions and why

- **One PR, four gated groups**: the migration and each auth change get a review stop.
- **Root tables only**: a student's own queries already filter by `user_id`, which implies
  the org, so denormalising `org_id` onto every child would only add drift. The org predicate
  is needed where one user reads or writes **another** user's data (staff paths).
- **`org_id` on `user_roles` + `platform_admin`**: a grant belongs to an org, ready for school
  admins in D3/D9, and the platform owner stays separate from Direct's admin. Existing
  `admin`/`teacher` grants become Direct grants. `SUPERADMIN_EMAIL` holds `platform_admin` and
  Direct `admin`.
- **Validation on a prod copy**: the backfill touches every user, so it is proven on real data
  before prod.

## Constraints

- One migration (generated + `--custom` for the seed and backfill) that adds columns nullable,
  backfills, then sets `NOT NULL` + FK, all in one transaction. Next number after `0013`.
  Enable RLS on `organizations`. `drizzle-kit push`/`pull` stay banned.
- Direct's id must be findable without a hard-coded uuid in app code: look it up by slug
  (cache it) or seed a fixed id in the migration and export it from one module. Pick one.
- `users` is a Better Auth table: add `orgId` as a new property only; rename nothing. Sign-in
  must never fail for lack of an org — the column default or `ensureStudentDefaults` sets it.
- `user_roles.org_id` is `NULL` only for `platform_admin`, and otherwise equals the user's
  `org_id` (a check or a guard in the one writer). The PK stays `(user_id, role_id)`.
- Each user belongs to exactly one org (mission non-goal). A class member, an invoice and a
  receipt share their user's org.
- Receipt numbers stay globally unique; the sequence is not per org.
- Permission helpers keep failing closed and keep their cache TTLs; if a cache key changes,
  old keys must not grant anything.
- The B2C unlock (boss opens the next lesson) and class-enabled lessons behave exactly as today
  for every student.
- `ASSIGNABLE_ROLES` does not include `platform_admin`; only the seed script grants it.
- No new env var.
