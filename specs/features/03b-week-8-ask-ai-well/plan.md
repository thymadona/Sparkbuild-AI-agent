# Week 8 — Ask AI Well: plan

Do the groups in order, one review each. Read `requirements.md` first. Skills: `ai-tutor`
(groups 1 and 4), `task-design` then `lesson-authoring` (groups 2, 3 and 5), and
`lesson-progress` (group 4, completion evidence).

## 1. Bolt guard rails

- `lib/helper/bolt.ts`: a comment in Bolt's code (full-line or inline, not a `#` inside a
  string) is an error back to the model, the same path as over 8 lines, with up to 2 retries.
  Still there → no block and `BOLT_FAILED`.
- `app/board/useBolt.ts` / `LiveBoard.tsx`: while `bolt.building`, hold Sparky-bound events (Run
  results, "I am stuck", step answers). Send them in order once Bolt's block is saved, after
  `helper_result`. If Bolt fails, send them straight away.
- `CLAUDE.md`: Bolt's hard-rule line gains "writes no comments".
- Tests: `__tests__/integration/api/helper.test.ts` covers a commented reply that is retried and a
  retry that fixes it, a reply that is still commented (no block, `BOLT_FAILED`), and a `#`
  inside a string that is allowed. A jsdom test checks that a Run during a build is held, and
  that Bolt's block is still on the board after the held turn.

## 2. Step sketches (design, no code)

- For each of the 9 tasks, write a task-design sketch: one idea, the misconception it fixes, the
  steps with their learning job, `go`, the checks in words (behaviour + notes count + `# ask:`),
  and the difficulty ramp. Apply the anti-repetition rule across the week and after week 7's last
  task.
- **Stop for the owner's approval.** Put the approved sketch into this folder as `sketch.md`.

## 3. Lesson skeleton (catalog, starters, fixtures)

- `lib/py-lessons.ts`:
  - An `ask()` check helper beside `guess()`. It matches a `# ask:` line with some words after it.
  - Append lesson 108 (`Week #8 — Robot Pet`, `aiPolicy: 'director'`, `badge: 'Bolt Boss'`,
    `extraFiles: { 'bugzap.py': 'py/w8-bugzap.py' }`) with 9 tasks, each its own program (`task(…, own)`). Every task has a `NOTE` check, and every
    core task has `ask()`. No steps yet.
- `lib/lessons/templates.ts`: `py/w8.py` and `py/w8-bugzap.py` (the `hw-bug-*` anchor and a crash).
  No comment in any Week 8 starter states the goal.
- `__tests__/fixtures/py/w8.solution.py` (one `# TASK: <id>` block per task) and
  `w8-bugzap.solution.py`, both with notes and `# ask:` lines.
- `__tests__/unit/lib/py-lessons.test.ts` checks each director lesson:
  - every task has a notes check, and every core task has an `ask()` check;
  - no starter comment other than a `# TASK:` or `hw-bug` anchor line.
- Add week 8's ids to `__tests__/fixtures/frozen-task-ids.json`.
- Run the `py-lessons` and `lesson-copy` tests. Every task fails on its starter and passes on the
  solution.

## 4. Sparky's side (rule 4)

- `lib/tutor/prompt.ts` `BOLT_RULE`: before `task_complete`, read the student's `#` notes and
  `# ask:` line. If a note only repeats the code, is not in the student's own words, or the ask
  is unclear, ask about it and do not complete. (As built: notes that repeat the code are refused
  statically, and Sparky judges the ask. See requirements, rule 4.)
- `__tests__/integration/api/task-complete.test.ts` (lesson 108):
  - pasted code that passes the behaviour checks but has no notes is refused by the static floor;
  - the same code with notes but no `# ask:` line is refused;
  - with both, the task completes.
- `__tests__/integration/api/turn.test.ts`: a tutor lesson's system prompt still has no Bolt
  text, and the new line appears only for a director lesson.
- `scripts/tutor-eval.ts` gets these cases:
  - Sparky will not complete on notes that just repeat the code;
  - Sparky will not complete with a missing or unclear `# ask:`;
  - Sparky completes when the notes are the student's own and the checks pass;
  - Bolt writes no comments.

  Every old case must still pass.

## 5. Concept steps

- Add `steps` and `go` to each task, following `sketch.md`. Task 8's weak request lives here, not
  in a starter.
- Every `stage` solution wins (`scenes.test.ts`), and the copy stays inside the word budgets
  (`lesson-copy.test.ts`).

## 6. Verify, docs and ship

- Docs:
  - `CLAUDE.md` ("weeks 1–6 exist" → 1–8);
  - the `lesson-authoring` skill (lesson count, ids 101–108, the stale director gotcha, `ask()`,
    director-lesson rules);
  - the `ai-tutor` skill (`BOLT_RULE` rule 4 line, the no-comments guard, held events);
  - the `lesson-progress` skill (notes and `# ask:` as rule 4's evidence).
- Work through `validation.md`: CI, the tutor eval, and the browser check at three widths with
  the Bolt timing. If the timing fails the 6 s rule, add a streaming item to the backlog.
- Open the PR (no migration, no env change) and tick roadmap box 3b.
