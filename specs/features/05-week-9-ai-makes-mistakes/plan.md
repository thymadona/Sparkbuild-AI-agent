# Week 9 — AI Makes Mistakes: plan

Do the groups in order, one review each. Read `requirements.md` first. Skills: `task-design`
then `lesson-authoring` (groups 1, 2 and 4), `ai-tutor` and `lesson-progress` (group 3).

## 1. Step sketches (design, no code)

- For each of the 9 tasks, write a task-design sketch:
  - the one idea and the misconception it fixes;
  - Bolt's exact starter with its planted bug, and the fix;
  - the steps with their learning job, and the `go` line;
  - the checks in words: behaviour (each "bug gone" check paired with a positive one), the notes
    count, and the `# bug:` line;
  - the tutor-only `prompt`: "scripted Bolt code under review" plus the planted bug;
  - the difficulty ramp.
- Apply the anti-repetition rule across the week, starting after week 8's last task with steps.
  Teach "test before you trust", and "review can end in no bug", in the steps.
- No `input()` anywhere. No starter comment except the `hw-bug-rex` anchor.
- **Stop for the owner's approval.** Put the approved sketch into this folder as `sketch.md`.

## 2. Lesson skeleton (catalog, starters, fixtures)

- `lib/py-lessons.ts`:
  - a `BUG_LINE` pattern and a `bug()` check helper beside `ask()`: a `# bug:` line with 3+ words
    after it, `judged`. Name the helper so it doesn't clash with the `bug` step builder.
  - Append lesson 109 (`Week #9 — Rex's Tricks`, `aiPolicy: 'director'`, `badge: 'Bug Spotter'`,
    `extraFiles: { 'bugzap.py': 'py/w9-bugzap.py' }`) with the 9 tasks from `requirements.md`.
    Each is its own program, except `hw-bug-rex` in `bugzap.py`. Every task has a notes check and
    the bug check, and the `prompt` comes from the sketch. No steps yet.
- `lib/lessons/templates.ts`: `py/w9.py` and `py/w9-bugzap.py` (the `hw-bug-rex` anchor and a
  crash).
- `__tests__/fixtures/py/w9.solution.py` (one `# TASK: <id>` block per task) and
  `w9-bugzap.solution.py`, both with notes and `# bug:` lines.
- `__tests__/unit/lib/py-lessons.test.ts`, the director rules:
  - every core task has an `ASK_LINE` **or** a `BUG_LINE` check;
  - the "fails on the starter even without notes/ask" test also drops `BUG_LINE`, so no Week 9
    task passes it on its judged line alone.
- Add week 9's ids and the anchor to `__tests__/fixtures/frozen-task-ids.json`.
- Run the `py-lessons` and `lesson-copy` tests. Every task fails on its starter and passes on the
  solution.

## 3. Sparky's side (rule 3)

- `lib/tutor/prompt.ts` `EXPLAIN_RULE` (director only) gains:
  - code in the editor counts once it is fixed and explained, even if Bolt first wrote it;
  - a `# bug:` line must say what the code did against what it should do. Check it against the
    planted bug in the task notes. `# bug: none` is right only when the task has no planted bug.
    With no planted bug (`ask-and-check`), judge it against the code and the runs;
  - while the student hunts, suggest an input or value to try, and never name the broken line or
    the fix.
- Check that `JUDGED` (`lib/task-checks.ts`) and the requirement lines in `lib/task-evidence.ts`
  read correctly for a `# bug:` check. Change the wording only if they say "ask" or "clear" in a
  way that misleads.
- `__tests__/integration/api/task-complete.test.ts` (lesson 109):
  - the fixed code with notes and no `# bug:` line is refused by the static floor;
  - the untouched starter with a `# bug:` line and notes is refused (the behaviour checks);
  - the fixed code with notes and a `# bug:` line completes.
- `__tests__/integration/api/turn.test.ts`: a tutor lesson's prompt has no bug clause, and a
  director lesson's prompt has it.
- `scripts/tutor-eval.ts` gets these cases. Every old case must still pass:
  - the fixed starter with a clear `# bug:` line and notes: Sparky completes (it does not refuse
    it as "Bolt's code");
  - `# bug: fixed it`: Sparky does not complete and asks what was wrong;
  - `# bug: none` on a planted-bug task: refused. On `hw-bolt-right`: completes;
  - "I am stuck" on a planted-bug task: Sparky suggests a test and does not name the line or fix.

## 4. Concept steps

- Add `steps` and `go` to each task, following `sketch.md`.
- Every `stage` solution wins (`scenes.test.ts`), and the copy stays inside the word budgets
  (`lesson-copy.test.ts`).

## 5. Verify, docs and ship

- Docs:
  - `CLAUDE.md`: "weeks 1–8 exist" → 1–9;
  - the `lesson-authoring` skill: the lesson count, ids 101–109, `bug()` / `BUG_LINE`, the
    ask-or-bug director rule, and drop the "only week 8 exists" gotcha;
  - the `ai-tutor` skill: the `EXPLAIN_RULE` bug clause and "suggest a test, never name it";
  - the `lesson-progress` skill: the `# bug:` line as rule 3's evidence.
- Work through `validation.md`: CI, the tutor eval, and the browser check at three widths.
- Open the PR (no migration, no env change) and tick roadmap box 5.
