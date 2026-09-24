# Week 9 — AI Makes Mistakes: requirements

Roadmap phase 5. The second director lesson, and mission rule 3: AI code is not trusted until the
student has checked it. Bolt wrote new tricks for Rex and got them subtly wrong. The student tests
each program, finds the mistake, fixes it and names it in a `# bug:` line.

## Scope

A new lesson, **`Week #9 — Rex's Tricks`** (id 109, `aiPolicy: 'director'`, badge **Bug Spotter**).
Each task is its own program (`task(…, own)`, week 8 style). Its starter is scripted Bolt code
with one planted mistake. The same bug for every student, so the checks can target it.

Tasks, in order (ramp: one wrong value → off by one → a missed case → too much → boss):

| #   | Id              | Type           | Bolt's mistake                                                                             |
| --- | --------------- | -------------- | ------------------------------------------------------------------------------------------ |
| 1   | `feed-rex`      | core           | Runs but wrong: `>` where `>=` is meant                                                    |
| 2   | `trick-count`   | core           | Off by one (a `range` one short or one long)                                               |
| 3   | `empty-bowl`    | core           | Misses a case: zero, empty or a tie                                                        |
| 4   | `just-asked`    | core           | Does more than was asked: an extra feature to remove                                       |
| 5   | `rex-check`     | core, **boss** | Two mistakes in one program                                                                |
| 6   | `ask-and-check` | choice         | No planted bug: ask the real Bolt, then test its answer and write `# bug:` (or `none`)     |
| 7   | `hw-rex-diary`  | bonus          | The wrong variable                                                                         |
| 8   | `hw-bolt-right` | bonus          | No bug. Add a print that tests an edge case and write `# bug: none …` with what they tried |
| 9   | `hw-bug-rex`    | bonus (bugzap) | `bugzap.py`: Bolt's program crashes, the week's only crash                                 |

The exact code, bugs, steps and copy are designed in plan group 1 (`sketch.md`), which the owner
approves before any catalog code.

Also in scope:

- A `# bug:` check helper, judged by Sparky like `# ask:`.
- A `# bug:` clause in the director-only `EXPLAIN_RULE`, and "suggest a test, never name the bug".
- The director-lesson invariant changes from "every core task has `ask()`" to "`ask()` **or** the
  bug check".

## Non-goals

- No change to Bolt: no prompt change, no deliberate bugs from the real Bolt, no seeded helper
  block. The real Bolt stays switched on, and its code never counts.
- No `input()` in any Week 9 program (see Constraints).
- No change to weeks 1–8, to `TUTOR_PROMPT`, or to how tutor lessons are judged.
- No test-case syntax (`# test: in -> out`). Testing is taught in steps and by Sparky, and the
  `# bug:` line is the record.

## Decisions and why

- **Scripted Bolt code, not live Bolt bugs.** Every student gets the same planted bug, so the
  checks fail on the starter and pass on the fix, and tests can prove it. A real Bolt told to add
  bugs would vary per student: the bug could be missing, too hard or impossible to check.
- **Bolt's code is the task's starter, in the editor.** The `go` line and the steps say "Bolt
  wrote this. Check it before you trust it." No server change: own-program starters already work
  this way. A seeded read-only Bolt block would break the "only the `bolt` actor adds a helper
  block" rule and be fiddly to copy on a phone.
- **Once the student fixes it, the editor code counts.** `BOLT_RULE` says Bolt's code never counts,
  which is about helper blocks. Sparky must not refuse the fixed starter as "Bolt's code". Each
  task's tutor-only `prompt` says the starter is scripted Bolt code under review and names the
  planted bug. The new `EXPLAIN_RULE` clause says code in the editor counts once it is fixed and
  explained, whoever first wrote it.
- **Evidence for rule 3: a `# bug:` line, own-words notes, and the fixed behaviour.**
  - A `# bug: …` line (3+ words) names what was wrong. A static check finds it. Sparky judges it,
    the same path as `# ask:` (`judged`).
  - Week 8's notes check (`ownWords`) stays on every task, so pasted code still needs the
    student's own explanation.
  - The behaviour checks prove the fix: the right output, with the planted bug gone.
- **How Sparky judges a `# bug:` line.** It must say what the code did against what it should do,
  like "Rex ate at 10 but 10 is enough". "fixed it" or "it was wrong" is not clear. Then by task:
  - a planted bug: the line must match the bug named in the task `prompt`;
  - `hw-bolt-right`: `# bug: none` plus what they tried is right. On any task with a planted bug,
    `none` is refused;
  - `ask-and-check`: no planted bug. Sparky judges the line against the code the real Bolt
    produced and the student's runs.
- **Sparky suggests tests and never names the bug.** Sparky asks what the code should do and
  suggests an input to try ("what if Rex has exactly 10?"). It never names the broken line or the
  fix, even after many tries. The mistake is the student's to find.
- **Director rule: `ask()` or the bug check on every core task.** Week 9 tasks don't start from a
  request, so a forced `# ask:` line would be a request the student never sent. The notes check
  stays on every director task. The rule also covers weeks 10–12.
- **Mistake kinds and extras (proposed, then approved with the task list).**
  - The owner had no preference on which kinds of mistake. Core tasks cover "runs but wrong", "off
    by one", "misses a case" and "does more than asked". Crashes go only in the bugzap, because
    Week 6 already teaches reading errors.
  - The choice task uses the real Bolt.
  - One bonus has correct code, so the student learns that review can end in "no bug".
- **Rex again.** Week 8's pet continues, so the week spends its words on reviewing, not a new world.
- **Step sketches are approved first** (plan group 1), as in weeks 7 and 8.
- **The planted-bug text ships in the browser bundle (a deliberate non-issue).** The catalog, task
  `prompt` included, is imported by client files (`LiveBoard`, `TaskHeader`, …). The bug is
  already in plain sight in the starter, so a student reading the bundle learns nothing the code
  doesn't show.

## Constraints

- **No migration and no new environment variables.**
- **No catalog version bump.** Lesson 109 is new, so weeks 1–8 do not change.
- **No `input()`.** Until phase 6 ships, `input()` on `/board` raises `EOFError`. Bugs live in
  fixed values and function calls, and edge cases are tried by changing a value or adding a call.
- **Task ids freeze once shipped.** Week 9's ids and the `hw-bug-rex` anchor go into
  `__tests__/fixtures/frozen-task-ids.json`.
- **Starters are TS strings** in `lib/lessons/templates.ts` (`py/w9.py`, `py/w9-bugzap.py`) or the
  tasks' own `starter` strings. **No comments in any starter** except the `hw-bug-rex` anchor, the
  existing director rule, since Bolt reads the page's code.
- **Pair every "the bug is gone" check with a positive check.** A check like "the extra line is
  gone" passes when the student deletes everything. Each such check sits beside one that proves
  the right behaviour is there.
- **Catalog invariants still hold:**
  - no task passes on its untouched starter, even without the notes, ask and bug checks;
  - every task passes on the solution;
  - one core boss, at least 2 bonus tasks, at least 1 bugzap.
- **Student copy budgets apply:** chip ≤ 5, success ≤ 8, label ≤ 6 and hint ≤ 10 words. The
  banned words apply too. The copy must be readable by an 11-year-old with English as a second
  language. "bug" is already a Week 6 word.
- **Prompt change.** `EXPLAIN_RULE` gains the `# bug:` clause and the "suggest a test" line. It
  appears only in director lessons, so weeks 1–7's system prompt does not change. Run
  `scripts/tutor-eval.ts` by hand.
- **Teachers turn the week on** per class from `/staff/classes/[id]`, the same as other weeks.
- **Every device.** The Week 9 steps, the editor and the checklist work at 375 px, 768 px and
  laptop widths.
