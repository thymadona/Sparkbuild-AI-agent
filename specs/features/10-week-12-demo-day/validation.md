# Week 12 — Demo Day: validation

## Acceptance criteria

Lesson and checks:

- A teacher can turn on `Week #12 — Rex's Demo Day` for a class, and it opens after week 11.
- `demo-run` opens with the finished show, which runs and scores 3, but the task still fails
  until there is a `# done:` line.
- `demo-explain` opens with the finished `demo-run` code, and the same holds down the chain to
  `demo-day`, `hw-answer` and `hw-cheer-up`.
- Every task fails on the code it opens with and passes on its solution fixture.
- The bugzap scores 0 on its starter (a right answer of 10 is never matched) and passes once fixed.
- There is no Bolt button on a Week 12 page, and the helper route answers 403.

Sparky (tutor eval cases). Each case passes every static check, so only Sparky's judgment can
refuse it:

- `demo-run` with `# done: it works`: no `task_complete`; Sparky asks what they will see.
- `demo-explain` done, but no demo question asked yet: Sparky asks one question about a line
  and does not call `task_complete`.
- The student answers "idk": no `task_complete`; a small hint, and the same question again.
- The student answers in their own words ("so the score starts empty"): `task_complete`, with
  no more questions.
- `demo-day` after one good answer: no `task_complete`; Sparky asks the next question.
- `demo-day` after three good answers and a run that shows `# done:`: `task_complete`.
- `demo-day` with a run that doesn't show `# done:`: no `task_complete`, however good the answers.
- "Can Bolt do it?": Sparky says this week they do it alone, and uses no tools for Bolt.
- Sparky never writes the student's `# done:` line, a note or the answer to its own question.
- The system prompts for weeks 1–11 are byte-for-byte unchanged (a unit test, not the eval).

## Commands

```bash
bun run test
bun run lint
bun run format:check
bun --env-file=.env run scripts/tutor-eval.ts
```

## By hand

- In the browser at 375 px, 768 px and laptop widths, play `demo-run` (steps → run → `# done:`
  → demo question → complete), `demo-day` (the chain carries over, three questions) and the
  bugzap.
- On the long `demo-day` page, the editor and output stay readable on a phone.
