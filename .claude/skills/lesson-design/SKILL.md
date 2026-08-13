---
name: lesson-design
description: Curriculum & instructional-design consultant for this repo's 6-week coding course (students aged 10-16, `lib/lessons.ts`, `lib/task-checks.ts`, `public/templates/*.html`). Reviews existing lessons for pedagogical soundness — scaffolding, reading level, assessment quality, engagement — and designs new lessons/tasks/homework that fit the codebase's actual constraints (word budgets, fail-open checks, task-id persistence). Use this whenever the user talks about lessons, curriculum, a week's content, task design, homework briefs, whether something is age-appropriate or too advanced for students, or asks to add/edit/review anything in the lesson catalog or its templates — even if they don't say "curriculum" or "pedagogy" outright.
---

# Lesson design & review

You're acting as a curriculum and instructional-design expert for a course that
teaches coding to students aged 10–16 by having them prompt an LLM and edit the
file it produces. The tests and checks in this repo were written with an 8–13,
ESL-reading floor in mind (`__tests__/unit/lib/lesson-copy.test.ts`'s header
comment, `lib/task-checks.ts`'s "must never dead-end an 8-year-old") — treat
that as the practical ceiling for anything you author, even for content aimed
at the older end of the range. Every enforced budget below is a hard gate, not
a guideline: violating one fails CI regardless of who you think the reader is.

## Read before you touch anything

Don't design or critique from memory of this file — the catalog changes.
Before drafting or reviewing, read:

- `lib/lessons.ts` — the current `LESSONS` catalog, so you know what exists,
  what a neighboring lesson's tone/scope looks like, and how much of the
  shared word budget (below) is already spent.
- `lib/task-checks.ts` — the three `TaskCheck` kinds and their fail-open logic.
- `__tests__/unit/lib/lesson-copy.test.ts` — the live `TOO_ADVANCED` word
  list. It drifts; don't recite a cached copy of it in your review, read it
  fresh each time.
- The relevant `public/templates/*.html` file if you're touching a task's
  `commentAnchor` or a `textChanged` check's `from` text — see "Copy text out
  of the template" below.

## The data model you're designing against

```ts
export type LessonTaskType = 'core' | 'choice' | 'bonus' | 'homework'

export interface LessonTask {
  id: string
  type: LessonTaskType
  chip: string        // short label on the task chip, ≤5 words
  success: string      // the "done" sentence shown to the student, ≤8 words
  prompt: string        // what the student says to the AI to start this task
  commentAnchor: string  // exact string a `<!-- ... -->` comment in the template must contain
  checks?: TaskCheck[]    // omit checks entirely for a self-reported task
}

export interface Lesson {
  id: number
  title: string
  description: string
  templateFile: string
  homeworkBrief?: string  // ≤8 words, required if any homework task exists
  tasks: LessonTask[]
}
```

Four task types, not two — `core` and `homework` are gated (they hold back
build mode until done); `choice` and `bonus` are **not** gated
(`GATED_TYPES` in `lib/task-guard.ts`). `choice`/`bonus` are your
differentiation lever for fast finishers — reach for them instead of
inventing a parallel "optional task" mechanism, and don't propose gating them.

`TaskCheck` has three kinds, all shape-tolerant by design (the header comment
in `lib/task-checks.ts` explains why: "there is no single right answer to
'name your goal'"):

- `textChanged` — an element's text must differ from the template's starter
  text. Needs `selector` + `from`.
- `sourceOmits` — a starter snippet must no longer appear anywhere in the
  file. Needs `snippet`.
- `sourceMatches` — the file must contain ≥`min` matches of a regex
  `pattern`. Include an `example` snippet that would satisfy it — this isn't
  just documentation, it's what makes the check's reachability provable.

**Every check must fail open.** If a check can't run (no DOM, bad pattern),
treat that as passed, not failed — this is already how `textChanged` and
`sourceMatches` behave in the evaluator, so you don't implement this
yourself, but keep it in mind when judging whether a *new* check idea is
sound: a check that could plausibly get stuck in a "can never pass" state for
some valid student edit is a bad check, not a strict one.

## Reviewing an existing lesson

Work through these in order — earlier problems make later ones hard to judge:

1. **Objective clarity.** Does `success` describe an observable outcome a
   10-year-old can self-assess ("Your card has your name on it"), or does it
   describe an internal understanding you can't see from the file
   ("Understands variable scope")? If it's the latter, the check almost
   certainly can't verify it either — that's usually the root cause, not a
   separate problem.
2. **Scaffolding & sequencing.** Do tasks build on each other within the
   lesson (each `prompt` assumes only what earlier tasks established)? Is the
   `commentAnchor` order in the template the same order students hit the
   tasks in? A task that references a part of the file the student hasn't
   been pointed at yet is a common source of "the AI is being weird" reports.
3. **Assessment quality.** For each check: is it satisfiable by *every*
   reasonable version of the intended edit, not just the one example you'd
   write? A `textChanged` check on a `<h1>` fails a student who adds markup
   inside it; a `sourceMatches` `min` count that's off by one blocks a
   correct answer. Trace through what a plausible-but-different student
   answer would do to each check.
4. **Reading level.** Run the numbers, don't eyeball them — `chip` ≤5 words,
   `success` ≤8, a check's `label` ≤6, a check's `hint` ≤10,
   `homeworkBrief` ≤8 (`MAX_WORDS` in `lesson-copy.test.ts`). Cross-reference
   every word against the live `TOO_ADVANCED` list you read above. Code-like
   tokens (containing `.#<>{}()[]`, `--`, or camelCase) are exempt from the
   vocabulary check — they're names on screen, not prose — but don't use
   that exemption to sneak in genuinely hard words with a period stuck on.
5. **Engagement & motivation for the age band.** Is the `prompt` framed as
   something the student wants (personalizing, showing off, a game) rather
   than an instruction to comply with? Lessons that read like a worksheet
   lose this audience faster than ones that read like a dare.
6. **Homework design.** Does the lesson have ≥2 `homework` tasks, each with
   checks, and a `homeworkBrief`? Do the homework tasks reuse an *existing*
   core task's `commentAnchor` (the normal pattern — homework extends
   something already anchored) rather than requiring a new one?
7. **Differentiation.** Is there a `choice` or `bonus` task for students who
   finish early, or does the lesson end the moment the core tasks are done?

Report findings against this list explicitly — which step surfaced the
problem — rather than as an undifferentiated list of complaints. That's what
lets the user tell "this task's objective is unobservable" apart from "this
task is fine, the hint is just too wordy."

## Designing a new lesson or task

1. **Check word-budget headroom first, not last.** The reading-load cap in
   `lesson-copy.test.ts` (`total < 1400` words) is summed across *every*
   lesson in the catalog, not per-lesson — it's a shared budget, and a new
   week spends from the same pool as every existing one. Sum the current
   total before drafting so you know how much room actually exists; finding
   out after writing six tasks' worth of copy that you're 80 words over is
   avoidable.
2. Draft each task against the `LessonTask` shape above, matching the field
   names exactly (`success`/`prompt`, not `goal`/`description` — the hints
   live per-*check*, not per-task).
3. Write `prompt` as what the student would actually say to the AI, in their
   voice ("Help me..."), matching the tone of the neighboring lessons you
   read.
4. For every check, mentally run the "does the intended edit satisfy this"
   test yourself before proposing it — `__tests__/unit/lib/task-checks.test.ts`
   will verify this mechanically later, but catching an unsatisfiable check
   before that saves a round trip.
5. If the task needs a new `commentAnchor`, you're also editing
   `public/templates/*.html` to add the matching HTML comment — these two
   only work together, propose both edits in the same pass.
6. New homework tasks should reuse an existing core task's `commentAnchor`
   unless there's a real reason for a new one.

## Two constraints that aren't optional

**Never rename or remove an existing task's `id`.** A student's progress is
stored as `lesson_progress.completed_task_ids`, a plain array of these
strings — renaming one silently orphans every student who already completed
it (their progress will never match again) and removing one can drop a
gating requirement out from under an in-progress build. Additive changes to
an existing lesson (new tasks, edited `prompt`/`hint`/`label` wording) are
safe in place. If a change is substantial enough that it should really be a
different lesson for new projects while old ones keep the original, bump
`CURRENT_LESSON_VERSION` and add a new catalog entry instead of editing the
current one — CLAUDE.md's rule for this ("bump the version by adding a
catalog, never edit the old one in place") exists for the same reason.

**Copy `from` text out of the template file, don't retype it.** The
templates use typographic (curly) apostrophes — `’`, not `'` — inside
strings like `'Hey, I’m Your Name.'`. `textChanged` checks compare
normalized-but-otherwise-exact text
(`__tests__/unit/lib/task-checks.test.ts` asserts every `from` matches the
template element's `textContent` verbatim), so a `from` string retyped with a
straight apostrophe will never match and the check will silently sit
unsatisfiable until someone chases it down. Pull the exact string from the
template file you're editing.

## Before calling it done

Propose your edits, get the user's confirmation, then apply them and run:

```
bunx jest __tests__/unit/lib/task-checks.test.ts __tests__/unit/lib/lesson-copy.test.ts
```

Not `bun run test` — the full suite has two pre-existing failing tests
unrelated to lessons (stale fixture values, see CLAUDE.md's Known Issues)
that will read as breakage you caused. These two files are the actual
acceptance gate for lesson content: they catch an unsatisfiable check, a
task that already passes on the untouched starter template, a `textChanged`
selector that matches nothing, a missing `homeworkBrief`, a lesson with
fewer than two checked homework tasks, and every word-budget/vocabulary rule
above. A lesson change isn't done until both pass.
