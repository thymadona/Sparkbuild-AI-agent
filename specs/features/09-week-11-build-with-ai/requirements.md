# Week 11 — Build With AI: requirements

Roadmap phase 9. The fourth director lesson and the final project. It joins mission rules 1, 2
and 4 in one program: the student plans the whole project, Bolt builds it one step at a time,
and the student explains each step. Rex hosts a quiz show. The student plans it once (a goal,
four steps and a done-check), then each core task builds one step on top of the last one.

## Scope

A new lesson, **`Week #11 — Rex's Game Show`** (id 111, `aiPolicy: 'director'`, `planFirst`,
badge **Show Builder**). The tasks, code, steps and copy are in `sketch.md` (plan group 1).

Eight tasks: four core tasks that build the show (`show-plan`, `show-question`, `show-score`,
boss `show-final`), the choice `show-extra` (the student's own mini show), and the bonuses
`hw-prize`, `hw-riddle` and the bugzap `hw-bug-show`.

Also in scope:

- **One task per step.** The four core tasks are one program, chained with `from`: each task
  starts from the previous task's finished code and adds the next `# step:`.
- **A new `# ask:` for each step.** `ask(n)` grows along the chain (1, 2, 3, 4), so an ask
  carried from an earlier task never meets the new step's check.
- **A step-by-step flag** (for example `stepByStep`) that Week 11 sets and Week 12 can reuse.
  It adds a STEP RULE for Sparky, **only in step-by-step lessons**, so the week 1–10 system
  prompts stay byte-for-byte the same:
  - each core task's new `# ask:` asks Bolt for this task's step only; an ask for the whole
    show, or for two steps, is refused (no `task_complete`), and Sparky asks for one step;
  - before `task_complete`, Sparky asks one short "why" question about a line Bolt wrote for
    this step, and completes once the student answers in their own words. It asks once per
    task and doesn't want perfect words.

## Non-goals

- No change to Bolt: not its prompt, not its 8-line cap, not the plan gate (reused as it is).
- No new check kind, board node or step type. No change to the turn route or task progress.
- No free choice of project. Everyone builds the same show; the choice task is the student's
  own idea, kept small.
- Week 12 (Demo Day). Its spec decides whether it reuses this project.
- No change to weeks 1–10, `TUTOR_PROMPT` or tutor lessons.

## Decisions and why

- **One fixed project.** Every step can be checked, and it follows the "no free-form project"
  rule. The questions are fixed sums (2 + 2, 3 x 3, 10 - 4), so the checks know the answers.
- **One task per step, no new Bolt gate.** The catalog structure forces "one step at a time"
  with the tools we already have: the page, the checks, the new `# ask:` and Sparky. Bolt may
  still build too much from one ask; Sparky refuses it, and that is a lesson too.
- **The plan is written once, in task 1.** From then on Bolt's plan gate is open, because the
  plan carries along the chain. The boss is where the run is finally matched to `# done:`.
- **Explaining = own-words notes + one "why" answer.** The notes check (`ownWords`) is reused.
  Sparky's one "why" question makes the student say what a line does and why it is there.
- **The student joins Bolt's code into their own.** Bolt writes a whole short program that
  runs on its own. Copying the new lines into the growing program is part of the job.
- **Rex again**, as a quiz show host. The last Rex week, so the words go on building.

## Constraints

- **No migration and no new environment variables.** The flag is a catalog field.
- **No catalog version bump.** Lesson 111 is new.
- **Task ids freeze once shipped.** Week 11's ids and the `hw-bug-show` anchor go into
  `__tests__/fixtures/frozen-task-ids.json`.
- **Starters:** `py/w11.py` is `''`. `show-plan`, `show-extra` and `hw-riddle` start empty;
  `show-question`, `show-score`, `show-final` and `hw-prize` start from the previous task's
  finished code. `py/w11-bugzap.py` holds only the anchor and the crash.
- **Catalog invariants hold for `from` tasks:** each behaviour check fails on the previous
  task's finished code, even without the notes, ask and plan checks. If the director tests
  assume a starter has no plan lines, fix the test's wording rather than the rule.
- **`input()` is allowed.** The core tasks feed inputs in this order: name, then answers.
- **Copy budget:** the step copy has about 60 words to spare after Week 11 (measured on `main`,
  2026-09-25). Reuse week 10's plan check labels so they count once.
- **The STEP RULE sits after the PLAN RULE** in the explain layer, and the Bolt line in the
  lesson layer is unchanged.
