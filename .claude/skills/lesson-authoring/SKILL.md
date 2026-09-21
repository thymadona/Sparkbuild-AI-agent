---
name: lesson-authoring
description: 'How to add or change lesson content — the `Lesson`/`LessonTask` shape in `lib/lessons.ts`, the v3 Python catalog in `lib/py-lessons.ts` (6 weeks, ids 101–106) and its check helpers (`match`, `output`, `world`, `calls`, `guess`, `runs`, `task`), the `# TASK: <id>` anchor convention in `public/templates/py/wN.py` and `wN-bugzap.py`, reference solutions in `__tests__/fixtures/py/`, the invariants `py-lessons.test.ts` enforces (no pass on starter, all pass on solution, one boss…), the student-copy word budgets and banned vocabulary in `lesson-copy.test.ts`, badges, XP per task type, and the catalog-versioning rule. Use for anything mentioning new lesson, new week, week 7, add/edit a task, homework brief, curriculum, starter file, template, bugzap, task anchor, check pattern, regex check, reading level, word budget, too advanced, vocabulary, badge, boss task, catalog version, py-lessons, task order, chip, success text. Use this before exploring `lib/py-lessons.ts`, `public/templates/py/`, `__tests__/fixtures/py/` — it already maps them.'
---

# Lesson authoring (Python catalog v3)

Lessons are code, not admin content: `lib/py-lessons.ts` exports `PY_LESSONS`, which
`lib/lessons.ts` re-exports as `LESSONS` under `CURRENT_LESSON_VERSION = 3`. Students are
10–16, many read English as a second language — every copy budget below is a **CI gate**.
How progress is verified at runtime is the `lesson-progress` skill.

## Shape (`lib/lessons.ts`)

```ts
interface Lesson {
  id: number // 101+ (ids 1–6 belonged to the retired web course; 0009 cleared them)
  title: string // 'Week #N — Name'; LessonsClient renders the part after '—'; week = array index + 1
  description: string
  templateFile: string // 'py/wN.py' under public/templates
  starterFile: string // project filename, always 'main.py'
  extraFiles?: Record<string, string> // { 'bugzap.py': 'py/wN-bugzap.py' }
  scene?: 'robot' | 'vault' // declared, not read yet (world node not built)
  badge?: string // won by the boss task
  aiPolicy?: 'tutor' | 'director' // declared, not read; director mode is not built
  homeworkBrief?: string // ≤ 8 words
  tasks: LessonTask[]
}
interface LessonTask {
  id: string
  type: 'core' | 'choice' | 'bonus' | 'homework'
  chip: string // ≤ 5 words — the page title on the board
  success: string // ≤ 8 words — the goal line
  prompt: string // what the student would ask Spark (not budgeted)
  commentAnchor: string // always `TASK: ${id}`, set by task()
  kind?: 'predict' | 'change' | 'make' | 'bugzap' | 'direct' | 'explain' // icon only (lib/lesson-ui.ts)
  boss?: boolean // exactly one per lesson, must be core; worth XP_BOSS, wins the badge
  checks?: TaskCheck[] // a task with no checks never auto-completes
}
```

Per-lesson task shape used by all six weeks: core ×4–5 (one is the boss) → choice ×1 →
bonus ×1 → homework ×2–3 (one of them a `bugzap` in `bugzap.py`). Existing: 101 Wake the
Robot (Robot Whisperer), 102 The Number Vault (Vault Cracker), 103 Repeat Reactor (Loop
Master), 104 Inventory Raid (Loot Lord), 105 The Spell Book (Spell Caster), 106 Bug Hunt
(Code Agent, single file).

## Check helpers (`lib/py-lessons.ts`)

| Helper                                                              | Produces                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `match(label, hint, pattern, example, min = 1, flags = 'm')`        | `sourceMatches` — the only static kind; `example` must satisfy the pattern (tested ×`min`) |
| `output(label, hint, pattern, { flags?, file?, inputs? })`          | `outputContains`                                                                           |
| `world(label, hint, pattern)`                                       | `worldContains` on `say:/color:/door:/alarm` transcript                                    |
| `calls(label, hint, call, file?)`                                   | `callReturns` with `equals: 'True'`                                                        |
| `guess(min)`                                                        | `sourceMatches` on a `# guess:` comment (predict tasks)                                    |
| `runs` / `runs3`                                                    | "It runs without errors" (`runs3` feeds `inputs: ['3','1','9','7']`)                       |
| `task(id, type, kind, chip, success, prompt, checks, boss = false)` | a `LessonTask` with the anchor set                                                         |

Regex constants (`ASSIGN`, `PRINT_LINE`, `PRINT_F`, `NOTE`, `WHILE`, `ASK`, `RANGE_STEP`,
`FOR_IN`) — reuse them. Labels ≤ 6 words, hints ≤ 10 words. A check that cannot run (bad
regex, Pyodide down) **passes**, so an unmatched pattern is a silent hole, not a wall — the
test suite is what catches it.

## Templates and anchors

- `public/templates/py/wN.py` + `wN-bugzap.py`. Every task's `# TASK: <id>` line must appear in
  one seeded file (the test checks); `highlightLinesForTask` finds it with `includes`, so
  **renaming an anchor comment silently breaks highlighting and the tutor's "point at the line"**.
- Anchors are followed by full-line `#` instructions and blank lines for the student.
- Bugzap files hold the `hw-bug-*` anchor and a deliberate crash.
- Reference solutions: `__tests__/fixtures/py/wN.solution.py`, `wN-bugzap.solution.py` — kept
  out of `public/` so students cannot fetch them. Resolved as
  `templateFile.replace('py/', '').replace(/\.py$/, '.solution.py')`.

## Adding a week — checklist

1. Append the `Lesson` to `PY_LESSONS` (next id, `templateFile: 'py/w7.py'`, `extraFiles`, `badge`, `homeworkBrief`, tasks via `task()`).
2. Write `public/templates/py/w7.py` and `w7-bugzap.py` with every anchor.
3. Write `__tests__/fixtures/py/w7.solution.py` and `w7-bugzap.solution.py`.
4. `NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/py-lessons.test.ts __tests__/unit/lib/lesson-copy.test.ts` (real Pyodide, ~2 min).
5. Nothing else: XP/badges derive from the catalog (`xp-and-streak`); teachers enable the new
   lesson per class from `/staff/classes/[id]`.

## Invariants enforced by `__tests__/unit/lib/py-lessons.test.ts`

Ids > 100 and unique · task ids unique per lesson · exactly one `boss`, and it is `core` ·
`badge` set · ≥ 2 homework tasks · ≥ 1 `bugzap` kind · every task has ≥ 1 check · every anchor
present in a seeded file · every runtime check's `file` is seeded · **no task passes on the
untouched starter** · **every task passes with the solution fixture** · every
`sourceMatches.example` repeated `min` times satisfies its check · every bugzap task fails on
the starter and passes on the fix.

## Copy budget (`__tests__/unit/lib/lesson-copy.test.ts`)

`MAX_WORDS = { chip: 5, success: 8, label: 6, hint: 10, brief: 8 }`; banned words list
`TOO_ADVANCED` lives in that test (milestone, customize, prototype, placeholder, gradient,
duration, specific, realistic, memorable, challenge, celebration, energetic, description,
collection, encouraging, instructions, statement, interaction, personalize, genuinely, …);
`TAUGHT_IN_PYTHON = ['variable', 'variables']` is exempt; total prose `< 300 × lessons` words;
≥ 30 copy entries per lesson. Code-ish tokens are stripped before counting.

## Versioning rule

`lesson_progress.completed_task_ids` stores task ids as plain strings. **Never edit v3 in
place once students have progress** — adding a task, renaming an id or reordering changes what
"done" means. Bump `CURRENT_LESSON_VERSION`, add a new catalog constant, keep the old one
resolvable if old projects must keep working (today they resolve to no lesson).
Copy-only fixes (typos, hints) are safe.

## XP per task (from `lib/xp.ts`)

core 10 · choice 15 · bonus 20 · homework 15 · boss 40. Details in `xp-and-streak`.

## Gotchas

- Comments in `py-lessons.ts` describe weeks 7–12 as `director` weeks; none exist and the turn route ignores `aiPolicy`.
- `scene` is set on every lesson but no board node draws the world yet (`components/SparkyWorld.tsx` has no caller).
- `app/lessons/[id]/LessonDetailClient.tsx` strips a `Task N — ` prefix that no chip has.
