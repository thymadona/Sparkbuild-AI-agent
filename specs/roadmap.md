# Roadmap

Small phases, done in order. Each phase gets a feature spec in `specs/features/<NN>-<slug>/`
(start one with the `feature-spec` skill). Tick the box in the PR that finishes the phase.
Replan between phases: is the next item still the right one?

**Done:** course weeks 1–12 (Wake the Robot → Rex's Demo Day), Bolt the helper AI, the tutor board with Sparky, and the
staff back office (classes, lesson unlocking, Telegram invoices).

Order: B0, then the Dashboard track D1→D6 (D7 waits for the ABA PayWay keys), with the Course
track in between as it fits. Revisit at each replan.

## Course track

- [x] **1. Week 7 — Dictionaries.** The last core Python concept, with no AI help.
- [x] **2. Replace the hourly cap with a burst limit.** 30 turns/minute instead of 50 turns/hour
      (`lib/ratelimit.ts`).
- [x] **3a. AI helper (Bolt).** A separate AI helper, Bolt, that writes a small read-only code block
      from the student's request, only in `aiPolicy: 'director'` lessons. Sparky stays a tutor who
      never writes code. Nothing reaches students until 3b ships.
- [x] **3b. Week 8 — Ask AI Well.** The student writes a clear request, and Bolt builds only what was
      described. Must decide how pasted Bolt code is judged (mission rule 4) before it ships.
- [x] **4. Delete dead code.** `components/SparkyWorld.tsx`, `components/PythonRunner.tsx`, the
      `/board` fixture demo, and stale comments about `/api/generate`, "build mode" and "Mark done".
- [x] **5. Week 9 — AI Makes Mistakes.** The AI writes buggy code, and the student reviews and fixes it.
- [x] **6. Cross-origin isolation for `/board`.** Fix the `next.config.js` headers so Python
      `input()` uses the proper path.
- [x] **7. Week 10 — Plan First.** The student writes a mini-spec (goal, steps, done-check) before the
      AI touches code.
- [x] **8. `app_settings` type.** Add its interface to `types/index.ts`.
- [x] **9. Week 11 — Build With AI.** Final project: the student plans, the AI helps one step at a
      time, and the student explains each step.
- [x] **10. Week 12 — Demo Day.** The student shows a finished program alone (Bolt off), explains
      each line, changes it live and answers Sparky's demo questions.

## Dashboard track

B2C first, B2B-ready: B2C is the built-in org "SparkBuild Direct" (see tech-stack).

- [x] **B0. B2C self-paced access.** A new student signs in and lands on `/lessons` with no staff
      step (no `/no-class`). Lesson 1 is open; beating a lesson's boss opens the next one. A class
      adds lessons and never removes any. B2C copy says "Lesson N", not "Week N". Free until D7.

- [ ] **D1. Organizations.** `organizations` table; `org_id` on users, classes, invoices and other
      tenant tables; backfill everything into SparkBuild Direct; roles scoped per org; an
      org-predicate hard rule in `CLAUDE.md`. Build it task group by task group.
- [ ] **D2. Subdomains & sign-in.** Wildcard domain; host → org in `proxy.ts`; `app.` and
      `console.` hosts; Google sign-in across subdomains; landing page on the apex domain.
- [ ] **D3. New dashboard shell.** Org-scoped layout for the org admin, plus a teacher view. It sits
      beside the old dashboards.
- [ ] **D4. People & classes.** Add and import students and teachers, deactivate; classes,
      schedules, teacher assignment, lesson unlocking.
- [ ] **D5. Reports.** Progress per class and per student, completion, activity, CSV export.
- [ ] **D6. Parent accounts.** Parent role, parent ↔ child link, a parent view of progress and invoices,
      and proof of skill at the end of the course (see backlog).
- [ ] **D7. Online payment & self-checkout.** ABA PayWay / KHQR; parent signs up → adds child →
      picks class or plan → pays; invoices and receipts. Likely splits (payment first, then checkout).
- [ ] **D8. Remove old dashboards.** Delete `/staff`, `/admin` and `/teacher` once D3–D7 cover B2C.
      B2C is complete at this point.
- [ ] **D9. Platform console.** At `console.`: create and suspend orgs, set subdomain, invite the
      first school admin.
- [ ] **D10. School billing.** Per-seat plans, seat counting, invoices from SparkBuild to the
      school, paid via ABA.
- [ ] **D11. Pilot school.** Onboard the first partner school, then replan from what we learn.

Unscheduled ideas live in [backlog/](backlog/README.md).
