---
name: feature-spec
description: Starts the next feature the spec-driven way — checks for a clean slate, reads the constitution in `specs/` (mission, tech stack, roadmap), interviews the user with AskUserQuestion about scope, decisions and validation, then writes `specs/features/<NN>-<slug>/{plan,requirements,validation}.md` on a new branch and stops for review. Use whenever the user says "start/plan/spec the next feature", "next roadmap phase", "feature spec", "let's do phase N", or `/feature-spec`. Do not use for one-line fixes, pure exploration, or implementing an already-written spec (that is a normal "implement group N of specs/features/…" prompt).
---

# Feature spec: plan a roadmap phase before any code

The spec is the memory of the project. Here the user makes the decisions and you write them
down. **Interview, don't infer:** never fill a decision from the existing code or docs without asking.

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

## 3. Interview (AskUserQuestion, small rounds)

1. **Scope:** what is in and what is explicitly out. Keep the phase as written, or split it?
2. **Key decisions and trade-offs:** give 2–4 options each, with your recommendation first.
3. **Conflicts:** name anything that clashes with the mission, a locked stack item or a
   `CLAUDE.md` hard rule, and let the user decide.
4. **Validation:** how both of you will know it is done.

After each round, show a short draft of what you heard.

## 4. Write the spec

Branch `<type>/<slug>` (as in `issue-workflow`). `<NN>` is the roadmap number, zero-padded.

- `specs/features/<NN>-<slug>/plan.md`: numbered task groups in order, each small enough to
  review in one sitting.
- `requirements.md`: scope, non-goals, the decisions made and why, and constraints (migrations,
  env vars, shipped task ids…). No low-level details such as variable names.
- `validation.md`: the tests to add; `bun run test`, `bun run lint`, `bun run format:check`;
  `scripts/tutor-eval.ts` if a prompt changed; a browser check at phone, tablet and laptop widths;
  what the user should try by hand.

## 5. Stop for review

Show the three files. Apply changes the user asks for through all three, so they stay in sync.
Then commit the spec by itself: `docs(specs): <slug> feature spec`.

## After this skill

Implementation is a separate step in a fresh context: "implement group 1 of specs/features/<NN>-<slug>".
Go group by group where mistakes compound (database, auth, progress). If review changes a
decision, fix the spec as well as the code. The PR that finishes the phase ticks its roadmap box.
