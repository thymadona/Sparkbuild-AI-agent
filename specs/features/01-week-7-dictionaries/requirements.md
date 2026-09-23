# Week 7 — Dictionaries: requirements

Roadmap phase 1. The last core Python concept, taught with Sparky as a tutor only.

## Scope

A new lesson, **`Week #7 — Monster Dex`** (id 107, badge **Key Master**). Sparky catalogues
monsters: each name has a power. The student adds new monsters, looks up unknown ones safely,
counts sightings and groups monsters by type.

Tasks, in order (ramp: change → guard → count → nest → boss):

| #   | Type           | Task            | New idea                                                          |
| --- | -------------- | --------------- | ----------------------------------------------------------------- |
| 1   | core           | New monster     | Add a key and change a value (`d[k] = v`, `d[k] = d[k] + 1`)      |
| 2   | core           | Unknown monster | A missing key crashes (KeyError); ask first with `in` or `.get()` |
| 3   | core           | Count sightings | Tally a list into a dict                                          |
| 4   | core           | Monster types   | A dict of lists                                                   |
| 5   | core, **boss** | Dex report      | Count sightings, print the most-seen monster and the total        |
| 6   | choice         | Release         | Remove a key (`del` or `.pop`)                                    |
| 7   | bonus          | My dex          | Build your own dict of 5 monsters                                 |
| 8   | bonus          | Explain the dex | A `#` note on each line                                           |
| 9   | bonus (bugzap) | Fix the crash   | Fix a KeyError crash in `bugzap.py`                               |

Also in scope: the `boxes` stage scene must draw keys added after the start (see Decisions).

## Non-goals

- No AI helper, no director mode. That begins with week 8 (roadmap phase 3).
- No new board type or stage scene.
- No tutor prompt change.
- No change to weeks 1–6. Week 4's dict intro (`item-stats`) stays as it is.
- Not in this phase: nested dicts (a dict inside a dict), dict comprehensions, `.keys()`/`.values()` as a topic, or sorting a dict by its values.

## Decisions and why

- **Go deeper than week 4, don't re-teach.** Week 4's `item-stats` already covers making a dict,
  looking up by key and `.items()`. Week 7 treats that as known, with one recap beat at most, and
  spends its tasks on the new skills.
- **Tutor only, like weeks 1–6.** The roadmap calls week 7 the last core concept "with no AI help".
  `specs/mission.md` now says weeks 1–7 are tutor weeks and weeks 8–12 bring the AI helper. The
  `lib/py-lessons.ts` header comment that says "weeks 7-12 … director" gets fixed to match.
- **Standard week shape.** One shared `main.py` with `# TASK:` anchors plus `bugzap.py`, the same
  as weeks 2–5, so the student already knows the layout. Five core tasks (one boss), one choice
  task, three bonus tasks.
- **Monster Dex story.** A dict is a lookup table, and a monster catalogue is a game version of
  that which kids care about.
- **The boss is the counting report.** Counting with a dict is the classic dict pattern, and the
  report brings the week together: counting, lookup and a loop over `.items()`.
- **Reuse the `boxes` scene** (each key is a labelled box). It already models name → value with
  `set`/`add` ops. The one gap: `BoxesView` only draws the boxes listed in the step's config, so a
  box for a new key (`set:imp=2`) would never appear. It must also draw keys that are in the state
  but not in the config. This keeps the board honest to Python: assigning to a new key creates it.
- **Concept steps are designed before they are coded.** Each task gets a task-design sketch that
  the owner approves first (plan group 2).

## Constraints

- **No migration and no new environment variables.**
- **No catalog version bump.** Lesson 107 is a new lesson, so weeks 1–6 do not change.
- **Task ids freeze once shipped.** After merge, week 7's task ids and `# TASK: <id>` anchors go
  into `__tests__/fixtures/frozen-task-ids.json`. From then on, renaming or removing one needs
  `TASK_ID_ALIASES`.
- **Starters are TS strings** in `lib/lessons/templates.ts` (`py/w7.py`, `py/w7-bugzap.py`), never
  files under `public/`. Reference solutions live in `__tests__/fixtures/py/`.
- **Student copy budgets apply** (chip ≤ 5, success ≤ 8, label ≤ 6, hint ≤ 10 words) and so do the
  banned words in `lesson-copy.test.ts`. The copy must be readable by an 11-year-old who speaks
  English as a second language.
- **Checks judge behaviour, not exact text.** Every task fails on the untouched starter and passes
  on the solution fixture.
- **XP and the badge come from the catalog**, with no code change: core 10, choice 15, bonus 20,
  boss 40.
- **Teachers turn the week on** per class from `/staff/classes/[id]`, the same as other weeks.
- **Every device.** Steps and the boxes scene must work on phone, tablet and laptop.
