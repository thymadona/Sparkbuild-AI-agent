---
name: lesson-authoring
description: 'How to add or change lesson content — the `Lesson`/`LessonTask` shape in `lib/lessons.ts`, the v3 Python catalog in `lib/py-lessons.ts` (9 weeks, ids 101–109) and its check helpers (`match`, `output`, `world`, `calls`, `guess`, `runs`, `task`), starters as TS strings in `lib/lessons/templates.ts` (`TEMPLATES`, `templateFor`) with the `# TASK: <id>` anchor convention for shared files (weeks 2–6) and per-task `starter`/`from` programs (week 1), concept `steps` (`LessonStep`: `choose`/`try`/`learn`/`order`/`bug`/`match`/`stage`) and `go`/`then`, reference solutions in `__tests__/fixtures/py/`, the invariants `py-lessons.test.ts` enforces (no pass on starter, all pass on solution, one boss…), the student-copy word budgets and banned vocabulary in `lesson-copy.test.ts`, badges, XP per task type, and the catalog-versioning rule. Use for anything mentioning new lesson, new week, week 7, add/edit a task, curriculum, starter file, template, bugzap, task anchor, concept step, quiz, stage, scene, sandbox, check pattern, regex check, reading level, word budget, too advanced, vocabulary, badge, boss task, catalog version, py-lessons, task order, chip, success text. Use this before exploring `lib/py-lessons.ts`, `lib/lessons/templates.ts`, `lib/board/scenes/`, `__tests__/fixtures/py/` — it already maps them.'
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
  templateFile: string // key into TEMPLATES in lib/lessons/templates.ts ('py/wN.py')
  starterFile: string // project filename, always 'main.py'
  extraFiles?: Record<string, string> // { 'bugzap.py': 'py/wN-bugzap.py' } — also TEMPLATES keys
  scene?: 'robot' | 'vault' // declared, not read yet (world node not built)
  badge?: string // won by the boss task
  aiPolicy?: 'tutor' | 'director' // 'director': Bolt answers and the explain rule applies (weeks 8–9)
  tasks: LessonTask[]
}
interface LessonTask {
  id: string
  type: 'core' | 'choice' | 'bonus'
  chip: string // ≤ 5 words — the page title on the board
  success: string // ≤ 8 words — the goal line
  prompt: string // what the student would ask Spark (not budgeted)
  commentAnchor?: string // `TASK: ${id}` for tasks sharing one starter file (set by task()); absent on own-program tasks
  starter?: string // week 1: the task's own program, seeded into its code node when its page opens
  from?: string // start from that earlier task's finished code (`starter` is appended)
  steps?: LessonStep[] // scripted concept steps shown before the editor (additive: no version bump)
  go?: string // said once above the editor when the steps end
  then?: { file: string; source: string; go: string; after: number } // a second program, revealed once checks[after] passes
  kind?: 'predict' | 'change' | 'make' | 'bugzap' | 'direct' | 'explain' // icon only (lib/lesson-ui.ts)
  boss?: boolean // exactly one per lesson, must be core; worth XP_BOSS, wins the badge
  checks?: TaskCheck[] // rubric for the tutor + live checklist; the tutor's task_complete finishes a task (lesson-progress)
}
type LessonStep =
  // graded on the client, no LLM call; a wrong answer twice still moves on
  | { kind: 'choose'; prompt; options; answer; explain; code? }
  | { kind: 'try'; prompt; template; chips?; need } // fill the {} in `template`, Sparky says it
  | { kind: 'learn'; prompt; frames: { code; note; hl?; speak? }[] }
  | { kind: 'order'; prompt; lines } // tap lines into order
  | { kind: 'bug'; prompt; code; bugLine; explain } // tap the broken line
  | { kind: 'match'; prompt; pairs: { left; right }[] }
  | {
      kind: 'stage'
      scene: 'room' | 'grid' | 'boxes' | 'machine'
      prompt
      config?
      goal
      palette: { label; ops }[]
      solution: number[]
    }
```

Two ways a task binds to code: weeks 2–6 share one starter file per week and each task's
`commentAnchor` marks its block; week 1 tasks each carry their own `starter` (`from` chains
them, e.g. boss/bonus build on an earlier task's final code) and their checks judge that
program alone. `then` adds a second file (own code block, Run and output) under the first.

Per-lesson task shape used by every week: core ×4–5 (one is the boss) → choice ×1 →
bonus ×3–4 (one of them a `bugzap` in `bugzap.py`). Existing: 101 Wake the
Robot (Robot Whisperer), 102 The Number Vault (Vault Cracker), 103 Repeat Reactor (Loop
Master), 104 Inventory Raid (Loot Lord), 105 The Spell Book (Spell Caster), 106 Bug Hunt
(Code Agent, single file), 107 Monster Dex (Key Master), 108 Robot Pet (Bolt Boss, the first
`director` week: every task is its own program), 109 Rex's Tricks (Bug Spotter, `director`: each
task's starter is scripted Bolt code with a planted bug to find, fix and explain; `hw-bug-rex` is
anchored in `bugzap.py`).

## Check helpers (`lib/py-lessons.ts`)

| Helper                                                                                        | Produces                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `match(label, hint, pattern, example, min = 1, flags = 'm')`                                  | `sourceMatches` — the only static kind; `example` must satisfy the pattern (tested ×`min`)                                                                                                                      |
| `output(label, hint, pattern, { flags?, file?, inputs? })`                                    | `outputContains`                                                                                                                                                                                                |
| `world(label, hint, pattern)`                                                                 | `worldContains` on `say:/color:/door:/alarm` transcript                                                                                                                                                         |
| `calls(label, hint, call, file?)`                                                             | `callReturns` with `equals: 'True'`                                                                                                                                                                             |
| `guess(min)`                                                                                  | `sourceMatches` on a `# guess:` comment (predict tasks)                                                                                                                                                         |
| `ask(min)` / `notes(min, hint)`                                                               | Director weeks: `ask` matches `ASK_LINE` (a `# ask:` line, 3+ words) and is `judged` (Sparky decides if it is clear); `notes` matches `NOTE` with `ownWords` (a note that only repeats its line does not count) |
| `bugNote(min)`                                                                                | Review tasks (week 9): matches `BUG_LINE` (a `# bug:` line, 3+ words), `judged` — Sparky checks it against the planted bug named in the task `prompt`. Named so it does not clash with the `bug` step builder   |
| `runs` / `runs3`                                                                              | "It runs without errors" (`runs3` feeds `inputs: ['3','1','9','7']`)                                                                                                                                            |
| `task(id, type, kind, chip, success, prompt, checks, boss = false, steps?, go?, then?, own?)` | a `LessonTask`; `own = { starter, from? }` makes it its own program, otherwise the anchor is set                                                                                                                |
| `choose`, `tryIt`, `learn`, `order`, `bug`, `pairUp`, `stage`                                 | `LessonStep` builders for `steps` (`stage` takes `palette` as `[label, ...ops][]`)                                                                                                                              |

Regex constants (`ASSIGN`, `PRINT_LINE`, `PRINT_F`, `NOTE`, `WHILE`, `ASK`, `RANGE_STEP`,
`FOR_IN`) — reuse them. Labels ≤ 6 words, hints ≤ 10 words. A check that cannot run (bad
regex, Pyodide down) **passes**, so an unmatched pattern is a silent hole, not a wall — the
test suite is what catches it.

## Templates and anchors

- Starters are TS strings: `TEMPLATES['py/wN.py']` / `['py/wN-bugzap.py']` in
  `lib/lessons/templates.ts`, read by `templateFor(key)`. Nothing lives under `public/` —
  `POST /api/projects` seeds a project from the catalog on the server (`lib/lesson-files.ts`),
  so students can neither fetch nor forge a starter.
- Weeks 2–6: every anchored task's `# TASK: <id>` line must appear in one seeded file (the
  test checks); the block view finds it by string match, so **renaming an anchor comment
  silently breaks it**. Anchors are followed by full-line `#` instructions and blank lines.
- Week 1: an own-program task has no anchor; `taskStarter()` (`lib/board/tasks.ts`) builds its
  code node from `from` + `starter` when the page opens. A `from` must name an earlier task.
- Bugzap files hold the `hw-bug-*` anchor and a deliberate crash.
- Reference solutions: `__tests__/fixtures/py/wN.solution.py`, `wN-bugzap.solution.py` — kept
  out of `public/` so students cannot fetch them. Resolved as
  `templateFile.replace('py/', '').replace(/\.py$/, '.solution.py')`. For own-program tasks the
  fixture is one `# TASK: <id>` block per task (the test chains `from`); a `then` program's
  solution is `wN-<then.file>.solution.py` (e.g. `w1-line2.solution.py`).
- A `stage` step's `solution` must really win its scene: `__tests__/unit/lib/scenes.test.ts`
  runs every catalog stage through `lib/board/scenes/` (`initial/apply/won/describe`).

## Adding a week — checklist

1. Append the `Lesson` to `PY_LESSONS` (next id, `templateFile: 'py/w7.py'`, `extraFiles`, `badge`, tasks via `task()`).
2. Add `'py/w7.py'` and `'py/w7-bugzap.py'` to `TEMPLATES` in `lib/lessons/templates.ts` with every anchor (or give each task its own `starter`).
3. Write `__tests__/fixtures/py/w7.solution.py` and `w7-bugzap.solution.py`.
4. `NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/py-lessons.test.ts __tests__/unit/lib/lesson-copy.test.ts __tests__/unit/lib/scenes.test.ts` (real Pyodide, ~2 min).
5. Nothing else: XP/badges derive from the catalog (`xp-and-streak`); teachers enable the new
   lesson per class from `/staff/classes/[id]`.

## Invariants enforced by `__tests__/unit/lib/py-lessons.test.ts`

Ids > 100 and unique · task ids unique per lesson · exactly one `boss`, and it is `core` ·
`badge` set · ≥ 2 bonus tasks · ≥ 1 `bugzap` kind · every task has ≥ 1 check · every anchor
present in a seeded file · every `from` names an earlier task · every runtime check's `file` is seeded · **no task passes on the
untouched starter** · **every task passes with the solution fixture** · every
`sourceMatches.example` repeated `min` times satisfies its check · every bugzap task fails on
the starter and passes on the fix.

## Copy budget (`__tests__/unit/lib/lesson-copy.test.ts`)

`MAX_WORDS = { chip: 5, success: 8, label: 6, hint: 10 }`; banned words list
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
Copy-only fixes (typos, hints) are safe, and so is adding `steps`/`go` to a task (ids and checks unchanged).

## Director lessons (`aiPolicy: 'director'`, week 8+)

Bolt reads the student's code, so `py-lessons.test.ts` enforces for every director lesson:
every task has a notes check and every core task an `ask()` **or** a `bugNote()` check; the
behaviour checks fail on the starter even without the notes, ask and bug checks; and no starter comment other than a `# TASK:` anchor (a comment
stating the goal would be read by Bolt). The tutor side of rule 4 (`EXPLAIN_RULE`) is in `ai-tutor`.

Review tasks (week 9): the starter is Bolt's code with one planted bug, and the tutor-only
`prompt` reads "Scripted Bolt code under review. Rule: … Planted bug: <behaviour>" (or "none").
Pair each "bug gone" `calls` check with a positive one. `calls` checks are not re-run on the
server (Node has no Python), so Sparky is what refuses an unfixed starter there.

## XP per task (from `lib/xp.ts`)

core 10 · choice 15 · bonus 20 · boss 40. Details in `xp-and-streak`.

## Gotchas

- `scene` is set on every lesson but no board node draws the world yet; it has no renderer.
- `app/lessons/[id]/LessonDetailClient.tsx` strips a `Task N — ` prefix that no chip has.
