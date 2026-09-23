# Week 7 — Dictionaries: plan

Do the groups in order, one review each. Read `requirements.md` first. Skills: `task-design`,
then `lesson-authoring`. Use `ai-tutor` only if something on the board breaks.

## 1. Boxes scene draws new keys

- `app/board/scenes/BoxesView.tsx` draws every key in the state, not only `config.boxes`. Keys that
  are not in the config come after the configured ones, in the order they were added. A new box
  pops like a changed box does.
- `describe()` in `lib/board/scenes/boxes.ts` already reads config. Check that it still reads well
  for the tutor when a goal names a key that is not in the config.
- Test: a stage whose solution adds a new key wins (`__tests__/unit/lib/scenes.test.ts`), and the
  view renders that box (a jsdom test beside the other board view tests).

## 2. Step sketches (design, no code)

- For each of the 9 tasks, write a task-design sketch: one idea, the misconception it fixes, the
  steps with their learning job, `go`, the checks in words, and the difficulty ramp. Apply the
  anti-repetition rule across the week (and after week 6's last task).
- Planned stage use: `boxes` for adding and changing keys (task 1) and for counting (task 3).
  `bug` for the KeyError (task 2). `walk` for the dict-of-lists (task 4).
- **Stop for the owner's approval.** Put the approved sketch into this folder as `sketch.md`.

## 3. Lesson skeleton (catalog, starters, fixtures)

- `lib/lessons/templates.ts`: `py/w7.py` (one `# TASK: <id>` block per anchored task, with the
  Monster Dex data the tasks need) and `py/w7-bugzap.py` (the `hw-bug-*` anchor plus a KeyError
  crash).
- `lib/py-lessons.ts`: append lesson 107 (`Week #7 — Monster Dex`, `aiPolicy: 'tutor'`,
  `badge: 'Key Master'`, `extraFiles: { 'bugzap.py': 'py/w7-bugzap.py' }`) with its tasks and
  checks, built from the existing `task`/`match`/`output`/`calls`/`runs`/`NOTE` helpers. No steps yet.
- Fix the header comment: weeks 1–7 are tutor weeks, weeks 8–12 are director weeks.
- `__tests__/fixtures/py/w7.solution.py` and `w7-bugzap.solution.py`.
- Add week 7's ids to `__tests__/fixtures/frozen-task-ids.json`.
- Run the `py-lessons` and `lesson-copy` tests. The starter fails every task and the solution passes every task.

## 4. Concept steps

- Add `steps` and `go` to each task, following `sketch.md`.
- Every `stage` solution wins (`scenes.test.ts`). Copy stays inside the word budgets (`lesson-copy.test.ts`).

## 5. Verify and ship

- Work through `validation.md` end to end: CI, the browser check at three widths, the hand
  play-through, and the teacher unlock.
- Open the PR and tick roadmap box 1 in `specs/roadmap.md`. No migration and no environment-variable changes.

## Follow-up (not this phase)

- The `task-design` skill's step-type menu leaves out the existing `walk` step. Add it.
