# Week 12 — Demo Day: requirements

Roadmap phase 10, the last week of the course. The student gives a demo of a finished program:
they run it and say what it shows, explain how each line works, change it live, and answer
Sparky's questions about it. They do it **alone**: Bolt is off, so the demo proves the skill.

## Scope

A new lesson, **`Week #12 — Rex's Demo Day`** (id 112, badge **Demo Star**). The tasks, code,
steps and copy are in `sketch.md` (plan group 1).

Eight tasks: four core tasks that demo Rex's quiz show (`demo-run`, `demo-explain`,
`demo-change`, boss `demo-day`), the choice `demo-own` (a small program of their own, demoed),
and the bonuses `hw-answer`, `hw-cheer-up` and the bugzap `hw-bug-demo`.

Also in scope:

- **A demo flag** on the lesson (for example `demo`) that adds a DEMO RULE to Sparky's prompt,
  **only in demo lessons**, so the week 1–11 system prompts stay byte-for-byte the same:
  - the `# notes` are checked for Sparky; it never asks for deeper notes;
  - `# done:` must name something on screen, and the last run must show it;
  - before `task_complete`, Sparky asks the demo questions the OPEN task's notes name: one
    in a core task or the choice, three in the boss (one per turn: what it does, why a line
    is there, what if). It completes once each is answered in the student's own words, even
    in simple English. "idk" gets a small hint and the same question again. It never answers
    its own question;
  - Bolt is off this week: if the student asks for Bolt, Sparky says this week they show what
    they can do alone.

## Non-goals

- No proof of skill for parents yet (certificate, report, share link). It waits for D6, the
  parent view; a public link would break the no-gallery rule. The backlog item stays.
- No copying the student's own Week 11 code. Everyone demos the same finished show.
- No change to Bolt, the turn route, task progress, `TUTOR_PROMPT` or weeks 1–11.
- No new check kind, board node or step type.

## Decisions and why

- **Week 12 is a full week.** It keeps the catalog shape (four core tasks with a boss, a choice,
  three bonuses and a bugzap), so no catalog test is relaxed.
- **A fixed finished show, seeded as the starter.** It is Rex's Game Show from Week 11 as
  code only, with no plan and no notes, so writing them is the student's job. It is the same
  for everyone, every step can be checked, and it needs no server code. A student who skipped
  Week 11 can still do the week.
- **Bolt off.** The lesson is not `director`, so the helper route answers 403 and the Bolt
  button is hidden. The student writes every change by hand.
- **Explaining = own-words notes + Sparky's demo questions.** The `ownWords` notes check is
  reused. The questions make the student say what the program does and why, like a real demo.
- **Only `# done:` from the plan lines.** A demo says what the program shows. `# goal:` and
  `# step:` were practised in weeks 10–11 and would add prompt rules.

## Constraints

- **No migration and no new environment variables.** The flag is a catalog field.
- **No catalog version bump.** Lesson 112 is new.
- **Task ids freeze once shipped.** Week 12's ids and the `hw-bug-demo` anchor go into
  `__tests__/fixtures/frozen-task-ids.json`.
- **Starters:** `py/w12.py` is `''`. `demo-run` starts from the finished show (its `starter`);
  `demo-explain`, `demo-change`, `demo-day`, `hw-answer` and `hw-cheer-up` start from the
  previous task's finished code (`from`, empty `starter`); `demo-own` starts empty.
  `py/w12-bugzap.py` holds only the anchor and the bug.
- **Every task fails on the code it opens with.** The starter already scores 3, so `demo-run`
  fails only on its missing `# done:`. `demo-explain` fails on its missing notes (its Score: 3
  check already passes); every later behaviour check must fail on the code it inherits. Only
  the "no pass on the untouched starter" test enforces this here: the stricter director test
  does not cover a non-director lesson, so keep it by design.
- **`input()` is allowed.** The show's inputs are, in order: the name, then the answers.
- **Copy budget:** measured on `main` (2026-09-26) with 11 lessons: task copy 2775 (cap 3600
  with 12 lessons), step copy 3021 (cap 3360, so under about 338 words for the week).
- **The prompt is the EXPLAIN RULE, then the DEMO RULE**, last in the system prompt. A judged
  check (`# done:`) tells Sparky to "see the explain rule at the end", so a demo lesson needs
  it. Not the PLAN RULE: its "ask for their `# goal:` first" would misfire with no `# goal:`, so
  the DEMO RULE restates the `# done:` judgment itself.
