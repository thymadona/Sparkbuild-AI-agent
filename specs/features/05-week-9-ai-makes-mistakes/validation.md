# Week 9 — AI Makes Mistakes: validation

## Tests to add or change

- `__tests__/unit/lib/py-lessons.test.ts`:
  - Lesson 109 passes every existing invariant: no pass on the starter, all pass on the solution,
    one core boss, at least 2 bonus tasks, at least 1 bugzap.
  - Director lessons: every task has a notes check, and every core task has an `ask()` **or** a
    bug check. Week 8 still passes.
  - Director lessons: every task fails on its starter with the notes, ask **and bug** checks
    removed.
  - Director lessons: no starter comment beyond a `# TASK:` or `hw-bug` anchor line.
  - `bug()`'s example satisfies `BUG_LINE`.
- `__tests__/unit/lib/lesson-copy.test.ts` and `scenes.test.ts` pass with lesson 109.
- `__tests__/fixtures/frozen-task-ids.json` holds week 9's ids.
- `__tests__/integration/api/task-complete.test.ts` (lesson 109):
  - Fixed code with notes and no `# bug:` line: refused.
  - The untouched starter with notes and a `# bug:` line: refused.
  - Fixed code with notes and a `# bug:` line: completes.
- `__tests__/integration/api/turn.test.ts`: a tutor lesson's prompt has no bug clause, and a
  director lesson's prompt has it.

## Commands (all must pass)

```bash
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/py-lessons.test.ts __tests__/unit/lib/lesson-copy.test.ts __tests__/unit/lib/scenes.test.ts
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/integration/api/task-complete.test.ts __tests__/integration/api/turn.test.ts
bun run test
bun run lint            # only the known no-page-custom-font warning
bun run format:check
bun --env-file=.env run scripts/tutor-eval.ts   # by hand, not in CI: the new Week 9 cases and every old case pass
```

Tutor-eval cases (group 3):

- the fixed starter with a clear `# bug:` line completes;
- `# bug: fixed it` is refused;
- `# bug: none` is refused on a planted-bug task and completes on `hw-bolt-right`;
- "I am stuck" gets a suggested test, never the line or the fix.

## Browser check (done in the in-app browser before the PR)

Week 9 is enabled for a test class, and the check runs as a student at 375, 768 and laptop widths:

- Each task's steps render and fit. The editor, the checklist and the `# bug:` hint are readable.
- Task 1: running Bolt's starter shows the wrong result. Fixing it and adding a note and a
  `# bug:` line completes the task through Sparky.
- On a planted-bug task, "I am stuck" gets a test to try, not the answer.
- The Bolt switch still works this week, and a Bolt block never ticks a check.
- Week 9 is hidden for a class that has not enabled it.

## By hand (optional, owner)

1. On task 1, write `# bug: fixed it`. Sparky asks what was wrong, and the task does not complete.
2. On `hw-bolt-right`, write `# bug: none` with what you tried, plus the test print. It completes.
3. Read the tutor-eval output for the Week 9 cases.
