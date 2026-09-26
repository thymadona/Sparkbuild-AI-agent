---
name: roles-permissions
description: How authorization works — per-org roles (admin, teacher, auto-granted student) plus the org-less `platform_admin` marker, organizations and the org predicate on every staff query, the 6 permission keys and which routes check each, the rules as Drizzle queries (`queryIsAdmin`, `queryCanAccessTeacherDashboard`; the old Postgres functions `has_permission`/`is_admin`/`is_teacher_of_class`/`can_access_teacher_dashboard`/`is_enrolled_in_class` were dropped), the `lib/auth/permissions.ts` API (`hasPermission`, `isAdmin`, `isTeacher`, `getStaffContext`, `isTeacherOfClass`, `getTeacherClassIds`, `STAFF_ROLES`) with cache TTLs and fail-closed behaviour, role assignment (`ASSIGNABLE_ROLES`, `/staff/users`), and how `/staff`, `/admin`, `/teacher` pages gate. Use for anything mentioning role, permission, authorization, admin, teacher, staff, student role, 403, hasPermission, isAdmin, isTeacher, user_roles, role_permissions, grant, revoke, class member, teacher of class, who can access, organization, org, org_id, org admin, school, platform_admin, cross-org, tenant isolation. Use this before exploring `lib/auth/permissions.ts`, `app/api/admin/`, `app/staff/` for gating logic — it already maps them.
---

# Roles and permissions

Authorization lives in the database (`roles`, `permissions`, `role_permissions`, `user_roles`)
and is checked **per route/page** in code. The route guard (`proxy.ts`, see `auth-flow`) only
covers page navigation; an API route without its own check is unprotected. `ADMIN_EMAILS` is
not a thing — role assignment lives in `user_roles`, editable at `/staff/users`.

## Organizations

Every user belongs to one org (`users.org_id`; SparkBuild Direct, `DIRECT_ORG_ID`, is the
built-in B2C org and where a new Google sign-in lands until D2; someone an org admin added by
email was pre-provisioned in that org). **Roles are per org**: a
`user_roles` row carries the user's `org_id`, and `admin`/`teacher` mean admin/teacher _of
that org_. Every rule below counts only grants in the user's own org, so an org-B admin has no
permission in Direct and vice versa. `getSessionUser()` returns `orgId`.

Permission says _what_ a user may do; the **org predicate** says _on which rows_. Every
staff query filters by `user.orgId` (see `database` for `usersInOrg` / `classesInOrg`), so
another org's id answers 404 and a cross-org write (member into another org's class, invoice
for another org's student, pay/send another org's invoice, unlock lessons in another org's
class) is refused.

Orgs are created, suspended and reactivated at `/console` by the platform owner (below).
People join an org in three ways, all through `addPersonToOrg` (`lib/org-people.ts`):

- a new email is pre-provisioned in the org with its role;
- an email already in the org gets the role granted;
- an email in Direct gets an `org_invites` row that only that signed-in user can accept
  (`lib/org-move.ts`, see `database`).
  An email in another school is refused (409, `CONFLICT_MESSAGE`). Nobody moves school → school
  or back to Direct.

**Suspension** (`organizations.status = 'suspended'`) pauses every member of that org:

- `getSessionUser()` returns null, so every API answers 401;
- `proxy.ts` answers `/api/*` with 403 and redirects pages to `/paused`.

The check is `isSuspendedFor` (`lib/orgs.ts`). It fails closed for a school's members, never
queries for Direct (which can't be suspended), and exempts `platform_admin`. Nothing is
deleted, so reactivating restores everything.

## Roles

| Role             | Seeded by      | Permissions                                                                                                    | Assignable from UI                                                                    |
| ---------------- | -------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `admin`          | `drizzle/0001` | all — `role_permissions` is a cross join, so a future key auto-belongs                                         | yes (`roles:manage`)                                                                  |
| `teacher`        | `drizzle/0001` | `students:message`                                                                                             | yes                                                                                   |
| `student`        | `drizzle/0004` | **none** — identity marker only                                                                                | no: system-managed, granted by `ensureStudentDefaults` on every sign-in (`auth-flow`) |
| `platform_admin` | `drizzle/0015` | **none** — org-less (`org_id` NULL) marker for the platform owner; gates `/console` and `/api/platform/*` only | no: only `bun run db:seed:admin` grants it (with Direct `admin`)                      |

Roles are additive: a promoted student keeps both rows. Consequence: **"has a `user_roles`
row" ≠ "is staff"** — filter with `STAFF_ROLES` (`['admin','teacher']`) where that matters
(`app/staff/classes/classes-data.ts`, `app/staff/classes/[id]/page.tsx`,
`app/staff/students/students-data.ts`, `app/staff/overview-stats.ts`). `class_members.role` (`'student'|'teacher'`) is per-class
membership, a different concept; the two tables never interact.

## Permission keys (all 6, seeded in `0001`; `homework:review` removed in `0011`)

| Key                | Checked in                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classes:manage`   | `app/api/admin/classes/route.ts`, `classes/[id]/route.ts`, `schedules/route.ts`; `classes/[id]/lessons/route.ts` and `classes/[id]/members/route.ts` (**or** `isTeacherOfClass`); `/staff/classes*` pages |
| `students:manage`  | `app/api/admin/students/route.ts`, `students/[id]/route.ts`; `admin/people` + `people/import` for a `student` row (`permissionForRole`); `/staff/students*`                                               |
| `invoices:manage`  | `app/api/admin/invoices/route.ts`, `invoices/[id]/route.ts`, `invoices/[id]/pay`, `invoices/[id]/send`; `/staff/finance`                                                                                  |
| `telegram:manage`  | `app/api/admin/telegram/updates/route.ts`; `/staff/telegram`                                                                                                                                              |
| `roles:manage`     | `app/api/admin/users/[id]/roles/route.ts`; `admin/people` + `people/import` for a `teacher` row; `admin/invites` (list) and `invites/[id]` (revoke); `/staff/users`                                       |
| `students:message` | seeded and granted to teacher, **never checked anywhere**                                                                                                                                                 |

`NAV_PERMISSION_KEYS` in `lib/dashboard-nav.ts` (`classes:manage`, `students:manage`,
`invoices:manage`, `roles:manage`, `telegram:manage`) drives sidebar visibility only.
Adding a key = insert into `permissions` (+ `role_permissions` for teacher if wanted; admin
gets it automatically) in a custom migration, check it in the route, add to
`NAV_PERMISSION_KEYS` if it should show a nav item.

## The rules (Drizzle queries in `lib/auth/permissions.ts`)

No SQL functions: the Supabase-era security-definer functions were dropped in `drizzle/0013`.

- permission: `user_roles ⋈ role_permissions ⋈ permissions` on `key`, grants in the user's own org only.
- admin: holds the `admin` role in their own org. Teacher of a class: that class's teacher
  row, or admin — and the class must be in the user's own org either way.
- `queryCanAccessTeacherDashboard`: admin, or a `class_members.role='teacher'` row in an
  own-org class. A membership row in another org's class counts for nothing.

The `query*` exports are uncached and **throw**; `proxy.ts` calls them and fails closed
(admin, dashboard). The cached wrappers below all fail closed.

## `lib/auth/permissions.ts`

| Export                                                                                                                                                           | Cache (`lib/cache.ts`)         | On DB error       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------- |
| `hasPermission(userId, key)`                                                                                                                                     | `perm:<user>:<key>`, 30s       | `false`           |
| `isAdmin(userId)`                                                                                                                                                | `role:admin:<user>`, 30s       | `false`           |
| `isTeacher(userId)` — role row, not class membership                                                                                                             | `role:teacher:<user>`, 30s     | `false`           |
| `getStaffContext(userId, keys)` → `{ isAdmin, permissions: Record<key, boolean>, teacherClassIds }` — one `db.execute` for all keys + one `class_members` select | `staff:ctx:<user>:<keys>`, 30s | all false / empty |
| `isTeacherOfClass(userId, classId)`                                                                                                                              | none                           | `false`           |
| `getTeacherClassIds(userId)` — own-org classes where `class_members.role='teacher'`; **not** all classes for admins                                              | none                           | throws            |
| `getUserRoles(userId)`, `roleIdByName(name)`                                                                                                                     | none                           | throws            |
| `requirePermission(userId, key)` → throws `ForbiddenError`                                                                                                       | —                              | unused            |
| `STAFF_ROLES`, `ForbiddenError`                                                                                                                                  |                                |                   |

Everything that answers a yes/no **fails closed**. A cache failure never changes the answer
(`redis-cache-ratelimit`). Because of the 30s TTL, a role change can take up to 30s to apply.

## Route pattern (first lines of every admin route)

```ts
const user = await getSessionUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (!(await hasPermission(user.id, 'classes:manage')))
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
// …then every query carries the org: eq(classes.orgId, user.orgId), usersInOrg(user.orgId), …
```

`hasPermission` is org-wide, not per row: a `classes:manage` holder may manage _their own
org's_ classes, so a route that takes a class id still has to check the class is in
`user.orgId` (`classInOrg`) before trusting the permission (`classes/[id]/lessons`).

**`/console` and `/api/platform/*`** check `isPlatformAdmin(user.id)` (cached 30s, fails closed)
through `requirePlatformAdmin()` (`lib/platform-orgs.ts`) as their first lines; `proxy.ts`
sends anyone else from `/console` to `/lessons`. A Direct `admin` gets 403 there.
`/api/invites` (GET) and `/api/invites/[id]/accept|decline` (POST) need only a session: they
act on the caller's own invites, matched by the caller's own email.

**Class rosters** (`classes/[id]/members`, POST/DELETE): a `classes:manage` holder may add or
remove any own-org user in any own-org class, as student or teacher. Otherwise the caller must
pass `isTeacherOfClass`, and then they may add or remove only **student-only** users (a
`student` grant in the org and no `STAFF_ROLES` grant, so a promoted student is refused), as
`role: 'student'`, and may not remove a teacher member.

- Refusals: another teacher's class in the same org is 403; another org's class or user is 404.
- The teacher view (`/staff/classes/[id]`, `RosterPanel`) offers only those candidates.

Role assignment (`app/api/admin/users/[id]/roles/route.ts`): `POST { role }` / `DELETE ?role=`;
`ASSIGNABLE_ROLES = ['admin','teacher']` (the `student` role is refused — the sign-in hook
would re-grant it anyway); DELETE refuses removing your own `admin` (lockout guard); inserts
carry `grantedBy: user.id` and the target's org. A target in another org → 404;
`platform_admin` → 400.

## Page gating

- `/staff/*` is the live back office. `app/staff/layout.tsx`: session → `/login`;
  `loadShellPermissions` (`lib/staff-shell.ts`: `getStaffContext(user.id, NAV_PERMISSION_KEYS)`
  plus `isPlatformAdmin`); not admin and not teacher of any class (`hasStaffAccess`) →
  `/lessons`. Each page re-checks its own key (`students:manage`, `roles:manage`,
  `invoices:manage`, `telegram:manage`; `/staff/classes/[id]` falls back to `isTeacherOfClass`).
  Nav visibility is not an access boundary.
- `/console/*` renders in the same `DashboardShell` as `/staff`: the sidebar shows
  "All Organizations" (`/console/orgs`, list; `/console/orgs/[id]`, detail) plus the read-only
  cross-org lists "All Classes", "All Students" and "All Users" (`/console/{classes,students,users}`,
  loaders in `app/console/platform-data.ts`, Organization column and filter, `?org=<id>` preselects
  one) when `isPlatformAdmin`. These are the only cross-org reads outside `orgs-data.ts`; they
  write nothing, and `/staff` stays org-scoped even for the platform owner. For a platform owner the
  sidebar hides the org-scoped Classes, Students and People & Roles (`orgOnly` in
  `lib/dashboard-nav.ts`); the pages still open by URL.
- AI usage (request counts and estimated cost, `lib/ai-usage.ts`; the pure estimate is
  `lib/ai-cost.ts`) is platform-owner only: read it from `/console` pages, never `/staff`. The
  console shows it platform-wide, per org and per student; org admins and teachers see none. `app/console/layout.tsx` re-checks `isPlatformAdmin` and nothing else, so a
  platform owner with no org role sees only that group (Overview is hidden: `hasStaffAccess`).
- `/admin/*` and `/teacher/*` are **redirect shells** to the `/staff` equivalents. Their
  layouts still gate (`isAdmin` / `getTeacherClassIds`) and `proxy.ts` gates them too.

## Gotchas / stale comments

- `students:message` and `requirePermission` are dead.

## Tests

- `__tests__/unit/lib/permissions.test.ts` — fail-closed behaviour, caching.
- `__tests__/unit/lib/guard.test.ts` — path precedence.
- `__tests__/integration/api/admin-user-roles.test.ts` — role assignment across orgs.
- `__tests__/integration/api/platform-orgs.test.ts`, `__tests__/integration/orgs-suspension.test.ts`,
  `__tests__/integration/session-suspension.test.ts` — the console and suspension.
- `__tests__/integration/api/admin-people.test.ts` — people, CSV, invites.
- `__tests__/integration/api/class-members-teacher.test.ts` — a teacher's roster rights.
- `__tests__/integration/api/invites.test.ts` — accept/decline and the org move.
- `__tests__/integration/api/admin-org-isolation.test.ts`, `__tests__/integration/staff-org-isolation.test.ts`
  — two orgs; every staff list, detail page and admin route stays in the viewer's org.
- `__tests__/helpers/db.ts` `makeOrg()`, `makeUser({ orgId })`, `makeClass({ orgId })`,
  `grantRole(userId, 'admin' | 'teacher' | 'student' | 'platform_admin')`.
