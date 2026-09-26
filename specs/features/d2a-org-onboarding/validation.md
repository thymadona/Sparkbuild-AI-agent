# D2a — Org onboarding: validation

## Acceptance criteria

Group 1 — console

- Only `platform_admin` opens `/console` or calls its API; a Direct admin gets 403 / redirect.
- The owner creates org "Test School" and names `a@x.com` its admin. `a@x.com` signs in with
  Google and lands in that org as admin. A duplicate slug or an email in another school is
  refused.
- A student, teacher or admin of a suspended org sees the paused page, and the board, lessons,
  `/staff` and every API refuse them. After reactivation, their projects and XP are intact.
- Direct can't be suspended.

Group 2 — people and CSV

- An org admin adds a new email as student or teacher; it signs in to the right org and role.
- Adding a Direct user's email creates an invite; the user is not moved until they accept.
- An email in another school org answers 409; an org-A admin can't add people to org B.
- A CSV with good and bad rows adds the good ones and reports each bad one with a reason.
- A school-org student sees only class-enabled lessons; a Direct student's boss unlock is
  unchanged.

Group 3 — rosters

- A teacher adds/removes a student of their own org in a class they teach.
- The same teacher can't touch another teacher's class, add a teacher member, or add a user from
  another org (each refused, cross-org as 404).

Group 4 — move flow

- A signed-in Direct user with a pending invite sees it and can accept or decline.
- A different user can't accept it.
- After accepting: the user is in the org with the invited role; old invoices/receipts moved with
  them; Direct class memberships are gone; projects, progress, XP and streak are unchanged.
- A Direct admin or teacher who accepts a student invite holds no admin/teacher grant afterwards.
- An unpaid Direct invoice blocks the move with a clear message.
- The move can't remove Direct's last admin.

Group 5 — docs

- `CLAUDE.md` and the skills describe `org_invites`, `/console`, suspension and class-only access.

## Commands

```bash
bun run db:generate && bun run db:migrate:test
bun run test
bun run lint
bun run format:check
bunx tsc --noEmit
```

No tutor prompt change, so no tutor eval.

## By hand

- As `SUPERADMIN_EMAIL`: create a school at `/console` and name a second Google account its admin.
- As that admin: add a student and a teacher by email and by CSV; invite an existing Direct
  account; accept the invite from that account and check its XP and projects.
- Suspend the school, then check the student is paused; reactivate it.
- Check `/console` and the new `/staff` pages at phone, tablet and laptop widths.
