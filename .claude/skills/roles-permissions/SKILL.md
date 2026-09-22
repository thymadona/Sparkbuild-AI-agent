---
name: roles-permissions
description: How authorization works — the three platform roles (admin, teacher, auto-granted student), the 6 permission keys and which routes check each, the Postgres functions `has_permission`/`is_admin`/`is_teacher_of_class`/`can_access_teacher_dashboard`/`is_enrolled_in_class`, the `lib/auth/permissions.ts` API (`hasPermission`, `isAdmin`, `isTeacher`, `getStaffContext`, `isTeacherOfClass`, `getTeacherClassIds`, `STAFF_ROLES`) with cache TTLs and fail-closed behaviour, role assignment (`ASSIGNABLE_ROLES`, `/staff/users`), and how `/staff`, `/admin`, `/teacher` pages gate. Use for anything mentioning role, permission, authorization, admin, teacher, staff, student role, 403, hasPermission, isAdmin, isTeacher, user_roles, role_permissions, grant, revoke, class member, teacher of class, who can access. Use this before exploring `lib/auth/permissions.ts`, `app/api/admin/`, `app/staff/` for gating logic — it already maps them.
---

# Roles and permissions

Authorization lives in the database (`roles`, `permissions`, `role_permissions`, `user_roles`)
and is checked **per route/page** in code. The route guard (`proxy.ts`, see `auth-flow`) only
covers page navigation; an API route without its own check is unprotected. `ADMIN_EMAILS` is
not a thing — role assignment lives in `user_roles`, editable at `/staff/users`.

## Roles

| Role      | Seeded by      | Permissions                                                            | Assignable from UI                                                                    |
| --------- | -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `admin`   | `drizzle/0001` | all — `role_permissions` is a cross join, so a future key auto-belongs | yes (`roles:manage`)                                                                  |
| `teacher` | `drizzle/0001` | `students:message`                                                     | yes                                                                                   |
| `student` | `drizzle/0004` | **none** — identity marker only                                        | no: system-managed, granted by `ensureStudentDefaults` on every sign-in (`auth-flow`) |

Roles are additive: a promoted student keeps both rows. Consequence: **"has a `user_roles`
row" ≠ "is staff"** — filter with `STAFF_ROLES` (`['admin','teacher']`) where that matters
(`app/staff/classes/page.tsx`, `app/staff/classes/[id]/page.tsx`, `app/staff/students/page.tsx`,
`app/staff/overview-stats.ts`). `class_members.role` (`'student'|'teacher'`) is per-class
membership, a different concept; the two tables never interact.

## Permission keys (all 6, seeded in `0001`; `homework:review` removed in `0011`)

| Key                | Checked in                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `classes:manage`   | `app/api/admin/classes/route.ts`, `classes/[id]/route.ts`, `classes/[id]/members/route.ts`, `schedules/route.ts`; `classes/[id]/lessons/route.ts` (**or** `isTeacherOfClass`); `/staff/classes*` pages |
| `students:manage`  | `app/api/admin/students/route.ts`, `students/[id]/route.ts`; `/staff/students*`                                                                                                                        |
| `invoices:manage`  | `app/api/admin/invoices/route.ts`, `invoices/[id]/route.ts`, `invoices/[id]/pay`, `invoices/[id]/send`; `/staff/finance`                                                                               |
| `telegram:manage`  | `app/api/admin/telegram/updates/route.ts`; `/staff/telegram`                                                                                                                                           |
| `roles:manage`     | `app/api/admin/users/[id]/roles/route.ts`; `/staff/users`                                                                                                                                              |
| `students:message` | seeded and granted to teacher, **never checked anywhere**                                                                                                                                              |

`NAV_PERMISSION_KEYS` in `lib/dashboard-nav.ts` (`classes:manage`, `students:manage`,
`invoices:manage`, `roles:manage`, `telegram:manage`) drives sidebar visibility only.
Adding a key = insert into `permissions` (+ `role_permissions` for teacher if wanted; admin
gets it automatically) in a custom migration, check it in the route, add to
`NAV_PERMISSION_KEYS` if it should show a nav item.

## SQL functions (`drizzle/0001`, security definer, `search_path = public`)

`has_permission(user, key)`, `is_admin(user)`, `is_teacher_of_class(user, class)` (admin-inclusive),
`can_access_teacher_dashboard(user)` (admin or any `class_members.role='teacher'` row),
`is_enrolled_in_class(user)` (student class row, or admin, or teacher role). `proxy.ts` calls
the last three; `permissions.ts` wraps the first three.

## `lib/auth/permissions.ts`

| Export                                                                                                                                                           | Cache (`lib/cache.ts`)         | On DB error       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------- |
| `hasPermission(userId, key)`                                                                                                                                     | `perm:<user>:<key>`, 30s       | `false`           |
| `isAdmin(userId)`                                                                                                                                                | `role:admin:<user>`, 30s       | `false`           |
| `isTeacher(userId)` — role row, not class membership                                                                                                             | `role:teacher:<user>`, 30s     | `false`           |
| `getStaffContext(userId, keys)` → `{ isAdmin, permissions: Record<key, boolean>, teacherClassIds }` — one `db.execute` for all keys + one `class_members` select | `staff:ctx:<user>:<keys>`, 30s | all false / empty |
| `isTeacherOfClass(userId, classId)`                                                                                                                              | none                           | `false`           |
| `getTeacherClassIds(userId)` — classes where `class_members.role='teacher'`; **not** all classes for admins                                                      | none                           | throws            |
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
```

Role assignment (`app/api/admin/users/[id]/roles/route.ts`): `POST { role }` / `DELETE ?role=`;
`ASSIGNABLE_ROLES = ['admin','teacher']` (the `student` role is refused — the sign-in hook
would re-grant it anyway); DELETE refuses removing your own `admin` (lockout guard); inserts
carry `grantedBy: user.id`.

## Page gating

- `/staff/*` is the live back office. `app/staff/layout.tsx`: session → `/login`;
  `getStaffContext(user.id, NAV_PERMISSION_KEYS)`; not admin and not teacher of any class →
  `/lessons`. Each page re-checks its own key (`students:manage`, `roles:manage`,
  `invoices:manage`, `telegram:manage`; `/staff/classes/[id]` falls back to `isTeacherOfClass`).
  Nav visibility is not an access boundary.
- `/admin/*` and `/teacher/*` are **redirect shells** to the `/staff` equivalents. Their
  layouts still gate (`isAdmin` / `getTeacherClassIds`) and `proxy.ts` gates them too.

## Gotchas / stale comments

- `permissions.ts` says "the four pages under app/staff/" match on `STAFF_ROLES` — it is three pages plus `overview-stats.ts`.
- `students:message` and `requirePermission` are dead.

## Tests

- `__tests__/unit/lib/permissions.test.ts` — fail-closed behaviour, caching.
- `__tests__/unit/lib/guard.test.ts` — path precedence.
- `__tests__/helpers/db.ts` `grantRole(userId, 'admin' | 'teacher')` for integration suites.
