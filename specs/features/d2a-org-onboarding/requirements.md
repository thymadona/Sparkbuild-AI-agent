# D2a — Org onboarding: requirements

## Scope

- `/console` (platform owner only): create, suspend and reactivate orgs; name the first org admin
  by email.
- `/staff` (org admin): add students and teachers by email, one at a time or by CSV import.
- A teacher adds and removes students of their own org in the classes they teach.
- An existing SparkBuild Direct user joins a school org by accepting an invite while signed in.
- School orgs are class-only for lesson access; Direct stays self-paced.

## Non-goals

- No subdomains, host → org or sign-in change (D2). Everything runs on the current host.
- No outbound email: an invite is seen in-app after Google sign-in.
- No new dashboard shell (D3); no deactivation, schedules or teacher assignment rework (D4).
- No parent accounts or parent consent (D6); a student accepts for themselves.
- No leaving an org, moving between two school orgs, or moving back to Direct.
- No per-seat billing (D10).

## Decisions and why

- **One phase, four gated groups**: the migration, each auth change and the org move each get a
  review stop.
- **`/console` is a new path; people and rosters extend `/staff`**: the console is cross-org,
  becomes the `console.` host in D2 and survives D8. The per-org pages are rebuilt in D3/D4
  anyway.
- **Consent by invite**: an org must not take an account just by typing its email. A new email is
  pre-provisioned directly (no account exists to take). An email already in Direct gets an invite
  that only that signed-in user can accept.
- **One org per user** (mission non-goal). Accepting moves `users.org_id`. Invoices, receipts and
  grants follow via the composite FKs (`on update cascade`). Projects, progress and XP stay
  (keyed by user id). Direct class memberships are dropped.
- **Refuse the move while an unpaid Direct invoice exists**: Direct's receivable must not show up
  in a school's finance. The Direct admin settles or voids it first.
- **Suspension pauses everyone, keeps everything**: it is reversible and billing-shaped. Nobody
  loses work.
- **School orgs are class-only**: a school decides the pace. A moved student keeps XP and can
  resume projects they started, but opens new lessons only when a class enables them.
- **Teacher rosters use `isTeacherOfClass`, no new permission key**: the right is per class, not
  org-wide.

## Constraints

- One migration, `0016`, for `org_invites` (org, email, role, invited by, status, timestamps),
  with `enable row level security`. `drizzle-kit push`/`pull` stay banned.
- An invite is bound to an email; only a signed-in user with that email may accept it. One
  pending invite per email per org.
- Accepting is one transaction. It first deletes the user's non-student org grants: otherwise
  the cascade turns a Direct `admin`/`teacher` grant into a school grant. Then it moves the org
  and grants the invited role. The org-less `platform_admin` grant is untouched.
- A move never removes Direct's last admin.
- Direct can't be suspended. `platform_admin` is exempt from suspension. The suspension check
  fails closed for a school org's members and must never block Direct.
- `platform_admin` still grants nothing inside an org. It gates `/console` and its API only, via a
  helper that fails closed.
- Every new staff query keeps the org predicate. `class_members` has no org FK, so a roster add
  checks the class and the user are both in the caller's org.
- A teacher may add/remove only student-role users, only in classes they teach.
- CSV: rows are validated one by one, bad rows are reported, good rows still apply. There is a
  row cap. Columns: email, name, role (`student`|`teacher`), optional parent email.
- `users` is a Better Auth table: rename nothing. `users.email` stays unique across orgs.
- Permission caches keep their 30s TTL. A role or org change may take up to 30s to apply.
- Direct's B2C unlock and class-enabled lessons behave exactly as today for Direct students.
- No new env var.
