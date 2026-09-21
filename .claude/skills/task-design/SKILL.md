---
name: task-design
description: 'How to DESIGN a new lesson task (its concept steps and teaching arc) before writing it — using Aristotelian teaching principles (ethos/pathos/logos, concrete→abstract, learning by doing, habituation then reasoning, the mean between too easy and too hard) and choosing the board step type that best fits each idea instead of repeating the same one. Covers the step-type menu (`learn`, `choose`, `try`/sandbox, `order`, `bug`, `match`, `stage` with its four scenes `room`/`grid`/`boxes`/`machine`, the live editor + trace) and how to judge whether a NEW board type (e.g. drawing) fits. Use whenever the user wants to design, plan, sketch or brainstorm a new task, week, or concept step; asks which step type to use; says lessons feel repetitive or students do not understand; or proposes a new board type. Use this BEFORE `lesson-authoring` (which then covers the code, checks and tests).'
---

# Task design

`lesson-authoring` says how to _encode_ a task. This skill decides _what the task should be_.
Output of this skill: a short **task design sketch** (below) the user approves, then hand off
to `lesson-authoring` to build it. Do not write catalog code until the sketch is agreed.

Audience: students 10–16, many with English as a second language. If they did not understand,
the task failed — whatever the check says.

## Step 0 — Discover what the board can do (always, before designing)

The menu below is a snapshot; the board grows. Read the source of truth first so you design with
what exists today, and notice anything new:

```bash
grep -n "z.literal(" lib/board/schema.ts          # every node type the board can render
sed -n '/^export type SceneId/,/^$/p' lib/board/scenes/index.ts   # stage scenes available
grep -n "case '" app/board/Nodes.tsx              # which node types actually have a renderer
ls app/board app/board/scenes lib/board/scenes    # <Name>Node.tsx / <Name>View.tsx per type
head -12 lib/board/scenes/*.ts                    # each scene's ops + goal shape (top comment)
```

Then for any type or scene **not in the menu below**, open its `*Node.tsx`/`*View.tsx` and its
schema entry, work out its learning job, and treat it as a candidate (say so in the sketch).
A type with a schema entry but no renderer (today: `preview`) is **not usable** — skip it.

Two kinds of board content exist, and the difference matters when designing:
- **Scripted steps** (`LessonStep` in `lib/lessons.ts`): `choose learn try order bug match stage`.
  Authored in the catalog, graded on the client, no LLM. This is what a task's `steps` may use.
- **Tutor-drawn nodes**: `heading`, `text`, `code`, `output`, `trace`, `diagram`, ungraded `quiz`.
  The tutor adds them live through tools (`lib/board/tools.ts`). They cannot be scripted into
  `steps`, but a task design can tell the tutor (via `prompt`/checks) when to reach for them,
  e.g. a `diagram` of `list_boxes` when a student is confused about lists.

## Principles (Aristotle → what to do)

| Principle                                            | In a task                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start from what the learner knows** (induction)    | Open with something they already do or see (a name, a score, a door). One familiar example before any rule.                                 |
| **Concrete before abstract**                         | See it happen (learn / stage / sandbox) → predict it → name it → then type it. Never open with syntax.                                      |
| **We learn by doing** (_ethike_: habit precedes rule)| Every new idea is _used_ by the student within one step of meeting it. Reps of the idea in changing contexts, not the same exercise twice. |
| **Cause, not just fact** (_logos_: the "why")        | After doing, one line on why it works (`explain`, a `learn` note). Trace/`bug` steps show cause.                                             |
| **The mean** (not too easy, not too hard)            | One new idea per step. Ramp: recognise → complete → fix → build. A step they cannot fail is filler; one with two new ideas is a wall.       |
| **Ethos / pathos / logos**                           | Ethos: Sparky is a friendly, honest guide (wrong answer = a hint, not a verdict). Pathos: a goal they care about (a game, a pet, a vault). Logos: the reasoning. |
| **Recognise → recall → produce** (_anagnorisis_)     | Understanding "clicks" at recognition. Prefer steps where the student _spots_ the idea (bug, order, match) before ones where they _generate_ it. |
| **Whole arc has a shape** (beginning-middle-end)     | Hook (goal) → discover (concrete) → try (guided) → own it (editor). Boss task = the payoff of the whole week.                              |

## Step-type menu — pick by the _learning job_, not by habit

(Snapshot — confirm against Step 0; add any newer type you found.)

All are graded on the client (no LLM call); the editor is the only step the tutor judges.

| Learning job                                 | Best type                          | Why it fits / when NOT to use                                                                                         |
| -------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Introduce** a new idea by showing it       | `learn` (≤4 frames)                | Code + what Sparky says, one idea per frame. Not for checking understanding.                                          |
| **Feel** what an expression does             | `try` (sandbox: fill `{}`)         | Instant live feedback, low stakes, `need` = how many variations to try. Best for string/print/f-string style ideas.   |
| **Predict** an outcome / check a concept     | `choose` (with `code`)             | Fast diagnostic; wrong options should be _real misconceptions_. Overused → prefer `bug`/`match` when possible.        |
| **Sequence** — order matters                 | `order` (2–4 lines)                | Teaches "top to bottom". Only if order genuinely changes the result.                                                  |
| **Debug thinking** — spot what is wrong      | `bug`                              | Cause-focused; great for errors students will hit later. Keep code ≤ 6 lines.                                         |
| **Vocabulary** — code piece ↔ meaning        | `match`                            | Recognition of symbols/keywords. Pairs must be unambiguous. Not for logic.                                            |
| **Variables & state** — a value in a place   | `stage` scene `boxes`              | Labelled boxes; ops `set`/`add`. Use for assignment, updating, types.                                                 |
| **Sequence + action** — instructions run     | `stage` scene `room`               | Say/colour/door events identical to real Python output. Bridges blocks → `print`/calls.                               |
| **Loops / repetition / direction**           | `stage` scene `grid`               | Sparky walks and picks gems (`move`/`left`/`right`). Repeats are visible. Use before `for`/`while`.                   |
| **Input → transform → output** (functions)   | `stage` scene `machine`            | Value goes through blocks (`upper`, `double`, `add:N`, `exclaim`). Use for functions, methods, chained operations.    |
| **Trace** — follow execution                 | trace node (`request_trace`, tutor)| Line-by-line vars/call stack. Use on the editor code for loops/functions once the student has run it.                 |
| **Explain a structure** the tutor draws      | `diagram` node (tutor-drawn)       | Kinds: `variable_boxes`, `list_boxes`, `flow`, `loop_counter`, `call_stack`. Not scriptable in `steps`; a rescue tool when a student is stuck. |
| **Produce** real Python                      | editor (`code` node + checks)      | The end of every arc, not the start. `go` says what to change; `then` gives a second file to apply it again.          |

**Limits that decide fit** (check the schema in `lib/board/schema.ts` before committing to a step):
- `try` (sandbox): Sparky speaks **only the typed value**, not the template; the template holds one
  `{}` (≤ 60 chars), value ≤ 40, `need` ≤ 4. So it fits `print("{}")`-style ideas and does **not**
  fit f-strings, variables or anything where the spoken result differs from what is typed.
- `learn` ≤ 4 frames, code ≤ 60 chars per frame; `order` 2–4 lines; `bug` code ≤ 200 chars, bug
  line ≤ 5; `stage` `solution` ≤ 8 blocks (palette indexes 0–7); `choose` ≤ 5 options.
- Boxes stage: one idea per goal — avoid mixing `set` with `add` unless updating is the lesson.

**Anti-repetition rule.** Before choosing, list the step types already used in the last two tasks
(and the same week). Do not use the same type twice in a row unless the learning job truly
repeats. A task's `steps` should usually use **2–4 different types**. `choose` is the default
crutch — reach for it last. Check current usage with:
`grep -nE "^\s*(choose|tryIt|learn|order|bug|pairUp|stage)\(" lib/py-lessons.ts`.

**Fit test per step.** State in one line: _"The student understands ___ because they ___."_ If the
verb is only "read" or "click the right one of 3", find a more active type.

## Designing a task — procedure

1. **Name the one idea** (a single sentence a 10-year-old could repeat) and the misconception it
   fixes. Two ideas → two tasks.
2. **Anchor in the student's world** — a goal they care about (Sparky, a game, a vault). Reuse the
   week's story; check `lib/py-lessons.ts` for the neighbouring tasks and what is already taught.
3. **Sketch the arc**: hook → discover → try → own it. For each beat pick a type from the menu by
   learning job; apply the anti-repetition rule and the fit test.
4. **Ramp difficulty**: recognise → complete → fix → build. Editor task last; its checks must
   fail on the starter and pass on the solution (`lesson-authoring` invariants).
5. **Read it as the student**: word budgets (chip ≤ 5, success ≤ 8, label ≤ 6, hint ≤ 10 words;
   banned advanced vocabulary), no English idioms, one instruction per line. If you cannot say it
   simply, the idea is too big.
6. **Present the sketch**, wait for approval, then build via `lesson-authoring`.

### Sketch template

```
Task: <id> · <chip>            Type: core|choice|bonus|homework
One idea: …                     Misconception fixed: …
Student's goal / story: …
Steps:
  1. <type> — job: <hook/discover/…> — "the student understands X because they Y"
  2. …
Editor: go = "…"  ·  checks = …  ·  then? = …
Why not <rejected type>: …
Difficulty ramp: …             New types/scenes needed: none | <see below>
```

## When a new board type is proposed (e.g. drawing)

The board is open to new types. Evaluate an idea before building it:

1. **Learning job** — which row of the menu above does it do _better_ than every existing type? If
   none, it is decoration; skip it. (Drawing example: it wins for **coordinates, loops, shapes,
   functions with parameters** — visible, creative output; it does _not_ beat `boxes` for variables.)
2. **Same truth as Python** — scene ops must mirror real Python behaviour (see `room`: block events
   = the events `py-runtime.py` emits) so block → code transfer is honest. Ideally the editor can
   later drive the same scene, so blocks and code produce the same picture.
3. **Fits the constraints** — Python-only platform (no HTML/web preview/gallery); runs in the
   browser; small, deterministic, gradable on the client with a `goal` + `won()` and a test that
   the `solution` wins (`scenes.test.ts`).
4. **Cost** — a scene is `lib/board/scenes/<name>.ts` (`initial/apply/won/describe`) + a
   `app/board/scenes/<Name>View.tsx` + registry in `scenes/index.ts` + the `scene` union in
   `LessonStep` + tests. Worth it only if ≥ 3 tasks across weeks would use it.
5. **Report** fit as: _fits / fits with changes / does not fit_, the tasks it would serve, and the
   cost. Prototype only after the user agrees.

## Handoff

Approved sketch → `lesson-authoring` (catalog shape, checks, templates, fixtures, tests, word
budgets, versioning) and `ai-tutor` (tutor prompt/eval if behaviour changes; run
`bun --env-file=.env run scripts/tutor-eval.ts` after prompt changes). Adding `steps` to an
existing task is additive and needs no catalog version bump.
