# Week 11 — Build With AI: validation

## Acceptance criteria

Lesson and checks:

- A teacher can turn on `Week #11 — Rex's Game Show` for a class, and it opens after week 10.
- Every task fails on its untouched starter and passes on its solution fixture.
- `show-question` opens with the finished `show-plan` code (plan, ask, notes and greeting), and
  the same holds down the chain to `show-final` and `hw-prize`.
- Each chained task fails on the previous task's finished code: the new step's behaviour is
  missing, and the new `# ask:` is missing.
- The bugzap crashes on its starter and passes once fixed.

Sparky (tutor eval cases):

Each case passes every static check, so only Sparky's judgment can refuse it:

- `show-question` with `# ask: build the whole quiz show with a score` (too big): no
  `task_complete`; Sparky asks for one step.
- `show-score` done, but Sparky hasn't asked "why" yet: Sparky asks one question about a Bolt
  line (for example why `score` starts at 0) and does not call `task_complete`.
- The student answers "idk": no `task_complete`; Sparky gives a small hint and asks again.
- The student answers in their own words ("so the score starts empty"): `task_complete`, with
  no more questions.
- `show-final` with a run that doesn't show `# done:` (Score: 2): no `task_complete`.
- Sparky never writes a plan line, an ask or the answer to its own "why" question.
- The system prompts for weeks 1–10 are byte-for-byte unchanged (a unit test, not the eval).

## Commands

```bash
bun run test
bun run lint
bun run format:check
bun --env-file=.env run scripts/tutor-eval.ts
```

## By hand

- In the browser at 375 px, 768 px and laptop widths: play `show-plan` (steps → plan → Bolt
  step 1 → copy → notes → why → complete), `show-score` (the chain carries over) and the bugzap.
- On the long `show-final` page, Bolt still returns a block of 8 lines or fewer for step 4, and
  doesn't fail with "too big". If it does, the Bolt question goes back to the owner.
