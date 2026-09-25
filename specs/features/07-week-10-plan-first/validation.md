# Week 10 — Plan First: validation

## Acceptance criteria

Lesson and checks:

- A teacher can turn on `Week #10 — Rex's Party` for a class, and it opens after week 9.
- Every task fails on its untouched starter and passes on its solution fixture.
- A `# goal:` line with fewer than 3 words is not found by the check. A full-line
  `# goal: …` comment does not count as a `# note`.
- An empty editor with only plan lines doesn't pass a task: a behaviour check still fails.

Bolt gate (week 10):

- Ask Bolt on a page with no plan: Bolt replies "plan first" (the fixed text), no code block
  appears, and DeepSeek is not called.
- Type `# goal:`, `# step:` and `# done:` lines, then ask again without reloading: Bolt answers.
- Remove the `# done:` line: Bolt refuses again.
- In weeks 8 and 9, Bolt answers with no plan on the page, exactly as before.

Sparky (tutor eval cases):

Each case passes every static check, so only Sparky's judgment can refuse it:

- `# goal: make a cool party` (vague): no `task_complete`; Sparky asks what Rex will show.
- `# done: it all works now`: no `task_complete`; Sparky asks what they will see on screen.
- In `plan-for-bolt` (only `runs` checks behaviour), a good plan whose last run doesn't show the
  done-check: no `task_complete`.
- A good plan, a matching run, and every check met: `task_complete`.
- Code with no plan: Sparky asks for the `# goal:` first. It never writes a goal, step or done
  line for the student.
- After Bolt says "plan first", Sparky never calls Bolt broken; it asks about the plan.
- The system prompts for weeks 1–9 are byte-for-byte unchanged (a unit test, not the eval).

## Commands

```bash
bun run test
bun run lint
bun run format:check
bun --env-file=.env run scripts/tutor-eval.ts
```

## By hand

- In the browser at 375 px, 768 px and laptop widths: play task 1 (steps → editor → complete),
  the boss (plan → Bolt refuses → plan → Bolt builds → copy → run → complete) and the bugzap.
- With a full plan on the page, Bolt returns a code block with no plan lines in it, and doesn't
  fail with "I could not build that".
- The owner plays the whole week as a student once, including a vague plan that Sparky refuses.
