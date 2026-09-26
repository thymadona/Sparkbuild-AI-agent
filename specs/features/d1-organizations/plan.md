# D1 — Organizations: plan

Read `requirements.md` and `validation.md` first. Do the groups in order.

1. **Organizations and org_id.** The goal: `organizations` exists with SparkBuild Direct seeded;
   `users`, `classes`, `invoices`, `receipts` and `user_roles` carry `org_id`; every existing row
   is backfilled to Direct and the columns are `NOT NULL` (except `user_roles`, see
   requirements). New sign-ins land in Direct. No behaviour changes yet.
   Skills: `database`, `auth-flow`. Risk: a migration that fails or half-applies on prod data;
   a new sign-in with no org breaks sign-in; a Better Auth property rename.
   Gate: **stop for review** (migration; run it on a prod copy first).

2. **Per-org roles and the platform role.** The goal: a role grant belongs to an org;
   `hasPermission`/`isAdmin`/`isTeacher`/`getStaffContext` answer for the user's own org;
   the org-less `platform_admin` role exists and `SUPERADMIN_EMAIL` holds it plus Direct admin.
   Role assignment in `/staff/users` grants in the target user's org and refuses other orgs.
   Skills: `roles-permissions`, `redis-cache-ratelimit`. Risk: locking every admin out (fail
   closed); a stale 30s permission cache across the change.
   Gate: **stop for review** (auth).

3. **Org predicate on staff queries.** The goal: every staff/cross-user read and write
   (`/staff` pages, `app/api/admin/*`, teacher views, Telegram send) is scoped to the viewer's
   org, and cross-org writes (member into another org's class, invoice for another org's
   student) are refused. Two-org tests prove it.
   Skills: `roles-permissions`, `database`, `lesson-progress`. Risk: a missed query leaks
   another org's students; B2C unlock or class-enabled lessons changing for students.
   Gate: **stop for review** (auth).

4. **Hard rule and docs.** The goal: `CLAUDE.md` has the org-predicate hard rule; the
   `database` and `roles-permissions` skills and `types/index.ts` match the code; the roadmap
   box for D1 is ticked.
   Skills: none. Risk: docs drift from code. Gate: continue.
