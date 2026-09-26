# D2a — Org onboarding: plan

Read `requirements.md` and `validation.md` first. Do the groups in order.

1. **Platform console.** The goal: at `/console`, the platform owner (`platform_admin`) lists
   orgs, creates one (name, slug), suspends and reactivates it, and names its first org admin by
   email. A suspended org's members see a "paused" page and every API refuses them.
   Skills: `roles-permissions`, `auth-flow`, `database`. Risk: `platform_admin` gaining powers
   inside an org; a suspension check that blocks Direct or fails open; `org_invites` migration.
   Gate: **stop for review** (migration, auth).

2. **People and CSV.** The goal: an org admin adds students and teachers by email in `/staff`,
   one at a time or from a CSV. A new email is pre-provisioned in the org with its role; a
   Direct email gets an invite; another school's email is refused. School orgs become class-only
   for lesson access.
   Skills: `roles-permissions`, `database`, `lesson-progress`. Risk: a cross-org write; a Direct
   student's self-paced unlock changing; CSV half-applying.
   Gate: **stop for review** (cross-org writes, lesson access).

3. **Teacher rosters.** The goal: a teacher adds and removes student members of their own org in
   the classes they teach, and nothing else.
   Skills: `roles-permissions`. Risk: a teacher reaching another teacher's class, adding a teacher,
   or pulling a user from another org. Gate: **stop for review** (auth).

4. **Move flow.** The goal: a signed-in Direct user sees their pending invite and accepts or
   declines it. Accepting moves them into the org with the invited role, keeps their projects,
   progress and XP, and drops their Direct class memberships.
   Skills: `database`, `roles-permissions`, `xp-and-streak`. Risk: a Direct admin grant cascading
   into a school admin grant; stranding an unpaid Direct invoice; accepting someone else's invite.
   Gate: **stop for review** (org move).

5. **Docs.** The goal: `CLAUDE.md`, the `database`, `roles-permissions` and `auth-flow` skills and
   `types/index.ts` match the code; the D2a roadmap box is ticked.
   Skills: none. Risk: docs drift. Gate: continue.
