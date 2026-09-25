# Week 10 — Plan First: requirements

Roadmap phase 7. The third director lesson, and mission rule 1: the student plans first, with a
goal and steps before the AI touches code. Rex is having a party. The student plans each part as a
mini-spec (`# goal:`, `# step:`, `# done:`) and then builds it. In the plan-writing tasks the
student writes the code. Bolt builds from a whole plan only in the boss and the choice task.

## Scope

A new lesson, **`Week #10 — Rex's Party`** (id 110, `aiPolicy: 'director'`, badge **Party
Planner**). Each task is its own program with an empty starter, except `hw-bug-party` in
`bugzap.py`. The tasks, code, steps and copy are in `sketch.md` (plan group 1).

Nine tasks: five core (`party-goal`, `party-invite`, `party-snacks`, `party-game`, boss
`party-show`), the choice `plan-for-bolt`, and the bonuses `hw-cake`, `hw-gifts` and the bugzap
`hw-bug-party`.

Also in scope:

- Plan check helpers: a `# goal:`, `# step:` or `# done:` line with 3+ words, `judged` like `# ask:`.
- **The Bolt plan gate.** A lesson flag (for example `planFirst`) that Week 10 sets and weeks 11–12
  can reuse. In a plan-first lesson Bolt refuses, with a friendly fixed reply and no LLM call,
  until the page's code has a `# goal:`, a `# step:` and a `# done:` line.
- A plan clause for Sparky, plus a line saying Bolt waits for a plan. Both appear **only in
  plan-first lessons**, so the week 8–9 system prompts stay byte-for-byte the same.
- The director invariant becomes: every core task has `ask()`, `bugNote()` **or** the goal check.

## Non-goals

- No change to Bolt's prompt. With a plan on the page it may build the whole plan in one go, up to
  8 lines. Week 10 allows that. Building one step at a time is Week 11.
- No plan card or any other new board node. The plan is comment lines in the editor.
- No per-task Bolt switch. Bolt is open in every Week 10 task once a plan exists.
- No change to weeks 1–9 (their lessons and system prompts), `TUTOR_PROMPT` or tutor lessons.

## Decisions and why

- **Plans first, Bolt last.** Tasks 1–4 and the bonuses teach writing plans, and the student
  writes the code (weeks 1–7 skills). Only the boss and the choice task send them to Bolt, so
  building step by step stays new for Week 11.
- **The plan is three comment lines.** They live in the editor beside the code, Bolt reads them,
  and the checks and Sparky already read the editor. A `# step:` line may repeat.
- **Bad plans appear only in steps** (`bug`, `order`, `choose`). Starters stay comment-free
  (the director rule), because Bolt reads the page's code.
- **The gate needs all three lines.** Mission rule 1 says "goal and steps", and phase 7 adds the
  done-check. The gate uses the same 3+-word regexes as the checks, so an empty `# goal:` doesn't
  open Bolt. It checks only that the lines exist. Sparky judges whether they are good.
- **The gate is fixed code, not a Bolt prompt rule.** It is honest (the model can't be talked out
  of it), costs no tokens, and every student gets the same answer.
- **A done-check is in words, matched to a run.** For example `# done: I see 3 invites, then
Bye`. Sparky checks that it names something on screen and that the last run shows it. "it
  works" and "no red text" are not done-checks. Where the task has a fixed goal, a behaviour check
  proves it too.
- **Where the plan sits in the file is not checked.** A static check can't tell whether the plan
  was written first. The gate enforces "plan before Bolt". In student-coded tasks Sparky asks for
  the `# goal:` first if they start with code.
- **Sparky never writes plan lines.** It asks questions ("what will Rex show?", "how will you
  know it worked?"). The plan is the student's thinking, like the code.
- **Rex again, at his party.** It's the third Rex week, so the words go on planning, not on a
  new world.

## Constraints

- **No migration and no new environment variables.** The flag is a catalog field.
- **No catalog version bump.** Lesson 110 is new.
- **Task ids freeze once shipped.** Week 10's ids and the `hw-bug-party` anchor go into
  `__tests__/fixtures/frozen-task-ids.json`.
- **Starters:** `py/w10.py` is `''` and `py/w10-bugzap.py` holds only the anchor and the crash.
  No other starter comments.
- **`input()` is allowed** (phase 6 shipped). Only task 4 uses it.
- **Gate details:**
  - it reads the same code block Bolt reads (the page's code node, anchor-scoped);
  - it runs after auth, `isUuid` and the director check, and before any DeepSeek call;
  - it writes no helper block;
  - the exchange is logged as a normal Bolt exchange, so Sparky sees it;
  - weeks 8–9 (no flag) behave exactly as now.
- **The plan regexes must not match `NOTE`** (full-line comments aren't notes). They sit beside
  `ASK_LINE`/`BUG_LINE`.
- **Catalog invariants hold:** no task passes on its starter, even without the plan, notes and ask
  checks; all pass on the solution; one core boss; ≥ 2 bonus; ≥ 1 bugzap.
