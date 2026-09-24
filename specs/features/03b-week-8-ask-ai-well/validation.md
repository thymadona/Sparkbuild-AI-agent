# Week 8 — Ask AI Well: validation

## Tests to add or change

- `__tests__/integration/api/helper.test.ts`:
  - Bolt's code with a comment is sent back and retried. A retry without comments lands the block.
  - Still commented after 2 retries: no block, and `BOLT_FAILED`.
  - A `#` inside a string (`print("#1 pet")`) is not a comment and is accepted.
- jsdom (`__tests__/unit/components/`, beside the 3a Bolt tests):
  - A Run while Bolt is building is held.
  - The held event is sent after `helper_result`, and Bolt's block is still on the board after
    Sparky's turn.
  - If Bolt fails, held events are sent at once.
- `__tests__/unit/lib/py-lessons.test.ts`:
  - Lesson 108 passes every existing invariant (no pass on the starter, all pass on the solution,
    one core boss, at least 2 bonus tasks, at least 1 bugzap).
  - Director lessons: every task has a notes check, and every core task has an `ask()` check.
  - Director lessons: no starter comment beyond `# TASK:` / `hw-bug` anchor lines.
- `__tests__/unit/lib/lesson-copy.test.ts` and `scenes.test.ts` pass with lesson 108.
- `__tests__/integration/api/task-complete.test.ts` (lesson 108):
  - Code that passes the behaviour checks with no notes: refused.
  - The same code with notes and no `# ask:`: refused.
  - With both: completes.
- `__tests__/integration/api/turn.test.ts`: a tutor lesson's prompt has no Bolt text. A director
  lesson's prompt has the rule 4 line.

## Commands (all must pass)

```bash
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/py-lessons.test.ts __tests__/unit/lib/lesson-copy.test.ts __tests__/unit/lib/scenes.test.ts
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/integration/api/helper.test.ts __tests__/integration/api/task-complete.test.ts __tests__/integration/api/turn.test.ts
bun run test
bun run lint            # only the known no-page-custom-font warning
bun run format:check
bun --env-file=.env run scripts/tutor-eval.ts   # by hand, not in CI: the new Week 8 cases and every old case pass
```

## Browser check (done in the in-app browser before the PR)

Week 8 is enabled for a test class, and the check runs as a student at 375, 768 and laptop
widths:

- The Sparky / Bolt switch fits and works. Bolt's block shows "You asked: …", read-only code and
  Run, and its output stays under the block.
- Each task's steps render and fit. The editor, the checklist and the `# ask:` hint are readable.
- Time 5 Bolt replies (from send to block). If the typical wait is over 6 s, add a "Bolt over
  SSE" item to the backlog and note it in the PR.
- A Run tapped during "Bolt is building…" does not drop the block.
- Week 8 is hidden for a class that has not enabled it.

## By hand (optional, owner)

1. On task 1, ask Bolt "make a pet", paste its code into the editor and run it. Sparky asks for
   notes and an `# ask:` line, and the task does not complete.
2. Read the tutor-eval output for the Week 8 cases.
