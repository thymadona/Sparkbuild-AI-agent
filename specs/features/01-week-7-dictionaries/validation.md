# Week 7 — Dictionaries: validation

## Tests to add or extend

- `__tests__/unit/lib/scenes.test.ts`: a boxes stage that adds a new key wins. Every week 7 stage
  solution wins. The second part is automatic once the steps exist.
- A jsdom test for `BoxesView`: a key that is in the state but not in the config renders as a box.
- `__tests__/unit/lib/py-lessons.test.ts` checks lesson 107 without any new code. Once the
  catalog and fixtures exist, it covers: one boss that is a core task, the badge is set, at least
  2 bonus tasks and at least 1 bugzap, every task has a check, every anchor sits in a seeded file,
  no task passes on the starter, every task passes on the solution, and the bugzap fails on the
  starter and passes on the fix.
- `__tests__/unit/lib/lesson-copy.test.ts`: word budgets, banned words, and at least 30 copy
  entries for the lesson.
- `__tests__/fixtures/frozen-task-ids.json` holds week 7's ids. Weeks 1–6 entries are unchanged.

## Commands (all must pass)

```bash
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/py-lessons.test.ts __tests__/unit/lib/lesson-copy.test.ts __tests__/unit/lib/scenes.test.ts
bun run test
bun run lint            # only the known no-page-custom-font warning
bun run format:check
```

`scripts/tutor-eval.ts` does not need to run because no prompt changes.

## Browser check (phone 375, tablet 768, laptop)

- Open a week 7 board. Every step type renders without horizontal scroll: learn, bug, walk,
  order, match, choose and the boxes stage.
- In the boxes stage, adding a new key shows a new box, and changing a key pops the box that
  changed.
- The editor, Run, the output and the live checklist are usable at every width.

## By hand (owner)

1. As staff, enable **Week #7 — Monster Dex** for a dev class in `/staff/classes/[id]`.
2. As a student in that class, start the lesson from `/lessons`.
3. For each task: the untouched starter does **not** complete. Write a real solution, run it, and
   ask Sparky. The task completes through `task_complete`, and the checklist and XP update.
4. Sparky gives hints but never writes the dict code for you.
5. `bugzap.py` crashes with a KeyError first, then says done once you fix it.
6. After the boss, the **Key Master** badge shows on the player card.
7. Weeks 1–6 still open and play as before.
