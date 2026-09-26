# D1 — Organizations: validation

## Acceptance criteria

Group 1 — data

- After the migration, every row in `users`, `classes`, `invoices`, `receipts` and
  `user_roles` (except `platform_admin`) points at SparkBuild Direct, and none is `NULL`.
- A brand-new Google sign-in creates a user in Direct and lands on `/lessons`.
- The migration runs cleanly on a copy of prod, and row counts per table are unchanged.

Group 2 — roles

- An admin of org B has no permission in Direct, and a Direct admin has none in org B.
- `SUPERADMIN_EMAIL` after `bun run db:seed:admin` holds `platform_admin` and Direct `admin`.
- `/staff/users` cannot grant a role to a user of another org, and `platform_admin` cannot be
  granted from the UI.
- A DB error in any permission helper still answers "no".

Group 3 — isolation (two orgs, each with an admin, a teacher, a class, students, an invoice)

- An org-A admin listing students, classes, invoices, receipts or users sees only org A.
- An org-A admin opening an org-B class, student or invoice by id gets 404.
- An org-A admin cannot add an org-B student to an org-A class, create an invoice for an
  org-B student, pay/send an org-B invoice, or unlock lessons in an org-B class.
- An org-A teacher sees only their own org-A classes.
- The staff overview counts only the viewer's org.
- A Direct student's unlocks, progress, board and helper behave exactly as before.

Group 4 — docs

- `CLAUDE.md` states the org-predicate rule, and the skills name the new table and columns.

## Commands

```bash
bun run db:generate && bun run db:migrate:test
bun run test
bun run lint
bun run format:check
bunx tsc --noEmit
```

No tutor prompt changes, so no tutor eval.

## By hand

- Run the migration against a prod copy (`DATABASE_URL=<copy> bun run db:migrate`), compare
  row counts, and spot-check that every `org_id` is Direct.
- Locally: sign in as a new Google user → `/lessons`, finish a boss, and the next lesson opens.
- Sign in as the Direct admin: `/staff` classes, students, finance and users look as they do
  today. Check at phone, tablet and laptop widths.
