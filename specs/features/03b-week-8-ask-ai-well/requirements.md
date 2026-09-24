# Week 8 — Ask AI Well: requirements

Roadmap phase 3b. This is the first director lesson. The student learns to write a clear request,
and Bolt (built in 3a) builds only what was described. This phase also settles the five items 3a
carried forward.

## Scope

A new lesson, **`Week #8 — Robot Pet`** (id 108, `aiPolicy: 'director'`, badge **Bolt Boss**).
The student describes a pet to Bolt, sees that a vague request gets a useless literal program,
and learns to say exactly what they want.

Tasks, in order (ramp: vague → exact → in/out → small pieces → boss):

| #   | Type           | Task           | Idea                                                                        |
| --- | -------------- | -------------- | --------------------------------------------------------------------------- |
| 1   | core           | Make a pet     | "make a pet" gets a useless literal result; rewrite it: name + what it says |
| 2   | core           | Exact words    | Name the exact output (words, numbers)                                      |
| 3   | core           | In and out     | Say what goes in (input) and what comes out                                 |
| 4   | core           | Small pieces   | A big request is refused (8-line cap); split it, join the pieces yourself   |
| 5   | core, **boss** | Pet game       | Name, mood, feed: 2–3 Bolt pieces joined in your editor, explained          |
| 6   | choice         | Pet trick      | Ask Bolt for one trick you choose                                           |
| 7   | bonus          | My own pet     | Your own pet, start to finish                                               |
| 8   | bonus          | Better request | Improve a weak request someone else wrote                                   |
| 9   | bonus (bugzap) | Fix the crash  | `bugzap.py`: Bolt built exactly what a bad request said; fix it so it runs  |

Also in scope:

- **Rule 4 in the catalog and in Sparky's director rule** (see Decisions).
- **Bolt never writes comments, enforced on the server.**
- **Hold Sparky while Bolt builds** (carry-forward 4).
- **The browser check that 3a deferred**, including timing Bolt's reply.

## Non-goals

- No Bolt persona art. Bolt keeps the "Bolt wrote this" block from 3a.
- No streaming for Bolt in this phase. It becomes a follow-up only if the timing check fails.
- No server guard that a task used Bolt. Using Bolt is optional.
- No protection against a forged or edited helper block through `PATCH /api/projects`
  (carry-forward 5, decided as a non-issue: see below).
- No plan-first gate (mission rule 1, Week 10) and no AI-bug review (rule 3, Week 9).
- No change to weeks 1–7, to `TUTOR_PROMPT`, or to how tutor lessons are judged.

## Decisions and why

- **Rule 4 is judged by notes in the code.** Every Week 8 task has a static check for inline `#`
  notes (the existing `NOTE` pattern), with the count set per task in the sketch. The boss needs a
  note on its main lines. `verifyTask` re-checks it on the stored code, so pasted Bolt code
  without the student's own notes cannot complete a task. Sparky reads the notes before it calls
  `task_complete`. A note that only repeats the code, or is not in the student's own words, gets
  a request to explain it, not a completion. This uses existing checks plus one line in the
  director-only `BOLT_RULE`.
- **Bolt never writes comments, and the server enforces it.** Rule 4 depends on every note being
  the student's own. A comment in Bolt's code is treated like the 8-line cap: an error back to
  the model, up to 2 retries, then no block and the "could not build" caption. A `#` inside a
  string is not a comment.
- **The request leaves a trace: a `# ask:` line.** Each core task needs a `# ask: …` comment in
  the editor holding the student's request, in the same style as week 1's `# guess:`. A static
  check confirms it is there, and Sparky judges whether it is clear. The week's real skill then
  becomes evidence, even when the student skips Bolt.
- **Bolt is optional.** Steps and Sparky push toward asking Bolt, but checks judge only the
  student's editor. There is no server guard that Bolt was used.
- **Each task is its own program (week 1 style), not one shared `main.py`.** On shared-file weeks
  a task's code node holds the whole file, carried forward, so the checks and Bolt would see
  every earlier task. One `# ask:` line and one note in task 1 would then satisfy tasks 2–5. With
  own programs (`task(…, own)`), checks, notes, `# ask:` and what Bolt sees cover only that task.
  No code change is needed.
- **No goal in the starter (carry-forward 2).** Bolt sees the student's code on the page. Every
  Week 8 starter, including each task's own `starter` and `bugzap.py`, has no comment that states
  the goal. The goal lives in the chip, the steps and Sparky's words. Task 8's weak request goes
  in its step or `go` copy, not in the starter. A test enforces this.
- **Hold Sparky while Bolt builds (carry-forward 4).** While "Bolt is building…" shows, the
  board holds Sparky-bound events (Run results, "I am stuck", step answers) and sends them once
  Bolt's block has landed. This closes the race where Sparky's end-of-turn board write dropped
  the block.
- **Forged helper blocks stay unprotected (carry-forward 5).** A block is never evidence, so a
  forged one only misleads the student's own Sparky chat. It is recorded as a deliberate
  non-issue.
- **Streaming only if Bolt is slow (carry-forward 3).** The browser check times 5 Bolt replies.
  If the typical wait is over 6 s, moving Bolt to SSE becomes a follow-up item (backlog or the
  roadmap). It is not built in 3b.
- **Bolt keeps the 3a look.** No avatar or new art.
- **Steps are designed before they are coded.** Each task gets a task-design sketch that the
  owner approves first (plan group 2), the same as week 7.

## Carry-forwards from 3a, settled

1. Mission rule 4: notes in the code, a `# ask:` line, the no-comments guard on Bolt, and
   Sparky's director rule (above).
2. Goal in starter comments: no goal comments in any Week 8 starter, with a test.
3. Browser check and timing: part of this phase's validation, with a 6 s rule.
4. The race during a Bolt build: hold Sparky's events.
5. Forged or edited helper block: left alone on purpose.

## Constraints

- **No migration and no new environment variables.**
- **No catalog version bump.** Lesson 108 is new, so weeks 1–7 do not change.
- **Task ids freeze once shipped.** Week 8's task ids (and `bugzap.py`'s `hw-bug-*` anchor) go
  into `__tests__/fixtures/frozen-task-ids.json`.
- **Starters are TS strings** in `lib/lessons/templates.ts` (`py/w8.py`, `py/w8-bugzap.py`) or
  the tasks' own `starter` strings. Reference solutions live in `__tests__/fixtures/py/`, and they
  carry the notes and `# ask:` lines the checks need.
- **Catalog invariants still hold:** no task passes on its untouched starter, every task passes
  on the solution, one core boss, at least 2 bonus tasks, at least 1 bugzap.
- **Student copy budgets apply** (chip ≤ 5, success ≤ 8, label ≤ 6, hint ≤ 10 words), and so do
  the banned words. The copy must be readable by an 11-year-old who speaks English as a second
  language.
- **Prompt change.** `BOLT_RULE` gains the rule 4 line. It appears only in director lessons, so
  the system prompt for weeks 1–7 does not change. Run `scripts/tutor-eval.ts` by hand.
- **Bolt's hard rule in `CLAUDE.md`** gains "writes no comments".
- **Teachers turn the week on** per class from `/staff/classes/[id]`, the same as other weeks.
  Until then no student reaches Bolt.
- **Every device.** The switch, Bolt's block and the Week 8 steps work at 375 px, 768 px and
  laptop widths.
