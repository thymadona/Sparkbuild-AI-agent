---
name: feature-spec
description: Starts the next feature the spec-driven way — checks for a clean slate, reads the constitution in `specs/` (mission, tech stack, roadmap), interviews the user with AskUserQuestion about scope, decisions and validation, then writes `specs/features/<NN>-<slug>/{plan,requirements,validation}.md` on a new branch and stops for review. Use whenever the user says "start/plan/spec the next feature", "next roadmap phase", "feature spec", "let's do phase N", or `/feature-spec`. Do not use for bug fixes, refactors, single-task catalog edits, pure exploration, or implementing an already-written spec (that is a normal "implement specs/features/…" prompt).
---

# Feature spec: plan a roadmap phase before any code

The spec is the memory of the project. Here the user makes the decisions and you write them
down. **Interview, don't infer:** never fill a decision from the existing code or docs without asking.

## 0. Does it need a spec?

A spec is for work that needs a decision only the user can make: a new week, a roadmap phase,
or a change to how tasks complete or are graded. If the answer is in the code (a bug fix, a
refactor, a single-task catalog edit, a copy tweak), say so in one line and just do the work.

## 1. Clean slate

Check each of these and stop if one fails:

- `git status` is clean, and the previous feature branch is merged into `main`.
- Show the next unchecked phase in `specs/roadmap.md` and ask whether it is still the right one
  (replanning). If the answer is no, update the roadmap first, on its own branch.
- If this conversation already holds unrelated work, suggest `/clear` first so the spec, not
  memory, carries the context.

## 2. Load context

Read `specs/mission.md`, `specs/tech-stack.md` and the roadmap phase. Then read the topic skill
from the `CLAUDE.md` skills index that matches the area (for a new lesson week, use `task-design`
first, then `lesson-authoring`). Read only enough code to ask good questions.

## 3. Interview (AskUserQuestion, one round)

The user's time is the slowest part of the process, so ask everything in one AskUserQuestion
call (up to 4 questions). Each option list puts your recommendation first:

1. **Scope:** what is in and what is explicitly out. Keep the phase as written, or split it?
2. **Key decisions and trade-offs:** 2–4 options each.
3. **Conflicts:** anything that clashes with the mission, a locked stack item or a `CLAUDE.md`
   hard rule.
4. **Validation:** how both of you will know it is done.

Before the questions, show one short list headed "I'll assume these unless you object": the
technical choices the code already settles (where a check lives, which test file, a helper
name). Product and teaching decisions are never on that list; they are questions. Ask a second
round only if an answer opens a new decision.

## 4. Write the spec

Branch `<type>/<slug>` (as in `issue-workflow`). `<NN>` is the roadmap number, zero-padded.
The spec and the code share this branch and one PR; the spec is not merged on its own.

Reading budget: `plan.md`, `requirements.md` and `validation.md` together stay under about 150
lines. The user reads every line before any code exists, so cut anything the implementer can
find in the code. `sketch.md` is outside the budget, because it holds the teaching decisions
the user must review.

Each fact lives in exactly one file. The implementer reads the code itself, so the spec holds
what the code can't tell it: intent, decisions and how to know it is done.

- `specs/features/<NN>-<slug>/plan.md`: short, at most about 30 lines. Numbered groups in order,
  each with only:
  - **goal**: one or two sentences on what is true when the group is done;
  - **skills** to load;
  - **risk**: what could go wrong (a shipped id, progress, auth, the prompt);
  - **gate**: `stop for review` or `continue`.

  No file paths, function names, step-by-step edits or test lists. The implementer finds those
  in the code, and a script written ahead of time goes stale when it meets the code.

- `requirements.md`: scope, non-goals, the decisions made and why, and **constraints**. The
  constraints are the non-obvious rules the implementer must not break: migrations, env vars,
  shipped task ids, "no `input()`", "no starter comment except the anchor", a name that must not
  clash. Anything that would otherwise have been a gotcha in the plan goes here.
- `validation.md`, the only home for tests: acceptance criteria as behaviour you can observe
  ("a `# bug: none` line on a planted-bug task is refused"), not as test file names. Then the
  commands: `bun run test`, `bun run lint`, `bun run format:check`; `scripts/tutor-eval.ts` with
  its new cases if a prompt changed; a browser check at phone, tablet and laptop widths; what
  the user should try by hand.
- `sketch.md`, for a new lesson week only: the task-design sketch (the code, the bugs, the steps
  and the copy). It is plan group 1, and the owner approves it before any catalog code.

## 5. Stop for review

Show the files. Apply changes the user asks for through all of them, so they stay in sync.
Then commit the spec as the first commit on the feature branch:
`docs(specs): <slug> feature spec`. Don't open a PR for it; it ships with the code.

## After this skill

Implementation is a separate step in a fresh context, on the same branch:
"implement specs/features/<NN>-<slug>".
Read `requirements.md` and `validation.md`, then work through the groups in order. Keep going
through `continue` groups. Stop at each `stop for review` gate: the sketch approval, a
migration, auth or progress code, and any tutor prompt change (run the tutor eval by hand first,
because it is not in CI). Check each group against its part of `validation.md` before moving
on. If review changes a decision, fix the spec as well as the code. One PR carries the spec
and the code, and it ticks the phase's roadmap box.
