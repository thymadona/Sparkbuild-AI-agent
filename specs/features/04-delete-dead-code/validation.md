# Delete dead code: validation

## Tests

No new tests: this phase only deletes code. The existing suites have to stay green, especially
the Pyodide world-check tests in `py-lessons.test.ts` and `BoltSwitch.test.tsx` (which renders
`BoardView`).

## Commands (all must pass)

```bash
bunx tsc --noEmit
bun run test
bun run lint            # only the known no-page-custom-font warning
bun run format:check
```

`scripts/tutor-eval.ts` does not need to run, because the prompt does not change.

## Zero-hit grep

Run from the repo root. It must print nothing. Hits under `specs/`, `drizzle/` and `node_modules/` don't count:

```bash
git grep -nE "SparkyWorld|(^|[^e])PythonRunner|BoardClient|board/fixture|lesson-project|PROGRESS\.md|api/generate|build mode|Mark done|/templates/" -- ':!specs' ':!drizzle'
```

## Browser check (phone 375, tablet 768, laptop)

- `/board/[id]` for a real project loads, a code node runs, and output appears.
- `input()` still works on the fallback path: the program asks, the student answers, and the
  program continues.
- A task with a world check still completes: week 1's "Sparky changes color" or week 2's "The door
  moves".
- A bare `/board` shows the 404 page when signed in. Signed out, it redirects to login first (the
  proxy guard), and so does `/board/[id]`.

## By hand (owner)

1. Open a student's board mid-lesson and finish a task with Sparky. Progress and XP update as
   before.
2. Open a director lesson (week 8) and ask Bolt for code. Bolt's block appears and Sparky waits.
