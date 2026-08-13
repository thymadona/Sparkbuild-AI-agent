# Week 7 — List Lab (to-do list + localStorage)

## What I did

I read the existing catalog (`lib/lessons.ts`), the check engine (`lib/task-checks.ts`), the
task-gating logic (`lib/task-guard.ts`), and both invariant test suites
(`__tests__/unit/lib/task-checks.test.ts`, `__tests__/unit/lib/lesson-copy.test.ts`) before
drafting anything, then added a 7th lesson object to the `LESSONS` array in
`lib/lessons.ts` (in the worktree), ran the two test files, and recorded the output.

**File changed:** `lib/lessons.ts` (`+66` lines, new `id: 7` entry appended to `LESSONS`,
between Week 6 and the `legacyTask` helper — nothing else touched).

## The drafted lesson

```ts
{
  id: 7,
  title: 'Week #7 — List Lab',
  homeworkBrief: 'Add a way to delete or count tasks.',
  description: 'Build a to-do list that remembers your tasks using localStorage.',
  templateFile: 'todo-list.html',
  tasks: [
    {
      id: 'list-name',
      type: 'core',
      chip: 'Name your list',
      success: 'Your list has your own title.',
      prompt: 'Help me rename my to-do list and write a short line about what it helps me do.',
      commentAnchor: 'TASK: list name',
      checks: [
        { kind: 'textChanged', selector: 'h1', from: 'My To-Do List',
          label: 'Your list has your name', hint: 'Change the big title to your own words.' },
        { kind: 'textChanged', selector: '.intro',
          from: 'Add tasks, check them off, and keep your list even after you close the page.',
          label: 'You wrote your own intro', hint: 'Rewrite the line under the title.' },
      ],
    },
    {
      id: 'first-tasks',
      type: 'core',
      chip: 'Add your first tasks',
      success: 'Your list shows tasks you picked.',
      prompt: 'Show me how to change the starter tasks in my list to things I actually need to do.',
      commentAnchor: 'TASK: starter tasks',
      checks: [
        { kind: 'sourceOmits', snippet: 'Walk the dog',
          label: 'Your first task is yours', hint: 'Change "Walk the dog" to your own task.' },
      ],
    },
    {
      id: 'save-storage',
      type: 'core',
      chip: 'Save your list',
      success: 'Your tasks stay after you refresh.',
      prompt: 'Help me use localStorage so my to-do list remembers my tasks after I close the page.',
      commentAnchor: 'TASK: save tasks',
      checks: [
        { kind: 'sourceMatches', pattern: 'localStorage\\.setItem', min: 1,
          example: "localStorage.setItem('tasks', JSON.stringify(tasks))",
          label: 'Your list saves tasks', hint: 'Call localStorage.setItem when tasks change.' },
        { kind: 'sourceMatches', pattern: 'localStorage\\.getItem', min: 1,
          example: "localStorage.getItem('tasks')",
          label: 'Your list loads saved tasks', hint: 'Call localStorage.getItem when the page loads.' },
      ],
    },
    {
      id: 'hw-delete',
      type: 'homework',
      chip: 'Homework: delete a task',
      success: 'You can remove a task you finished.',
      prompt: 'I want a button that deletes one task from my list.',
      commentAnchor: 'TASK: starter tasks',
      checks: [
        { kind: 'sourceMatches', pattern: '\\.filter\\(', min: 1,
          example: 'tasks = tasks.filter((task, i) => i !== index)',
          label: 'Your code removes a task', hint: 'Use filter to drop one task from the list.' },
      ],
    },
    {
      id: 'hw-counter',
      type: 'homework',
      chip: 'Homework: count tasks left',
      success: 'Your page shows how many tasks are left.',
      prompt: 'I want my page to show how many tasks I still need to do.',
      commentAnchor: 'TASK: save tasks',
      checks: [
        { kind: 'textChanged', selector: '#count', from: '0 tasks left',
          label: 'The count is real', hint: 'Show the number of unfinished tasks.' },
      ],
    },
  ],
}
```

## Reasoning / decisions

**Structure.** Every existing week (1–6) follows core → core → core → choice → bonus →
homework × 2. I deliberately dropped the `choice` and `bonus` tasks here and shipped
3 `core` + 2 `homework` (5 tasks instead of the usual 7). Reason: `lesson-copy.test.ts` caps
total reading load at 1400 words across *all* lessons, and the six existing lessons already
total 1238 words (verified by evaluating `LESSONS` directly) — only ~160 words of headroom
before Week 7 existed. A full 7-task lesson matching the other weeks' shape runs 190–220 words
each (I measured all six); that would have blown the ceiling by 30–60 words. Trimming to 5
tasks landed Week 7 at 140 words, bringing the new total to 1378/1400. If a `choice`/`bonus`
pair is wanted for parity with other weeks, ~20 more words of budget would need to be cut
elsewhere first (e.g., shortening a hint in an existing lesson) — I did not touch existing
lessons since that felt out of scope for "draft the Week 7 lesson."

**Check design, mapped to the invariants the test suite enforces:**
- `no task may pass on the untouched starter template` — every `from`/`snippet` is starter-only
  text the check requires to be *replaced*, not present.
- `every textChanged check must resolve to an element that actually holds the from text` —
  I picked selectors (`h1`, `.intro`, `#count`) that mirror the existing templates' conventions
  (`personal-page.html` uses `h1` + `.lead`, `score-page.html` uses `h1` + `.subtitle`, etc.),
  but **since no real template exists yet, this is unverified** — see "What's still needed."
- `checks fail open` — I used the same three check kinds (`textChanged`, `sourceOmits`,
  `sourceMatches`) already in the codebase; no new check kind was introduced, so the existing
  fail-open behavior in `lib/task-checks.ts` (`evaluate()`) applies unchanged.
- `sourceMatches` checks all carry an `example` string, since
  `'documents an example for every sourceMatches check'` requires it and the test also replays
  that exact example (repeated `min` times) to prove the check is satisfiable.
- Homework: 2 tasks with checks + a `homeworkBrief`, matching
  `'gives every lesson homework with checks'` (`homework.length >= 2`, brief truthy, each
  homework task has `checks.length > 0`).
- `commentAnchor` values reuse the `TASK: <name>` convention from other lessons, and homework
  tasks point back at an earlier core task's anchor (`hw-delete` → `TASK: starter tasks`,
  `hw-counter` → `TASK: save tasks`) — the same pattern Week 1–6 homework uses (e.g. Week 1's
  `hw-avatar` points at `TASK: identity`).

**Vocabulary.** I avoided every word on `lesson-copy.test.ts`'s `TOO_ADVANCED` list. `localStorage`
itself is a code identifier (mixed-case, matches the test's code-token filter regex
`[a-z][A-Z]`) so it's exempt from the reading-level check, but it still counts toward the word
budget — that's already priced into the 140-word total above.

## What's still needed before this lesson is real

I did **not** author `public/templates/todo-list.html` (the task said this wasn't required).
For the lesson to actually work, someone needs to build that template with:
- an `<h1>` containing exactly `My To-Do List`
- an element with class `intro` containing exactly
  `Add tasks, check them off, and keep your list even after you close the page.`
- a starter task list that includes the literal string `Walk the dog`
- a `script.js`/inline script with task-add/render logic, ready for a student to wire
  `localStorage.setItem`/`getItem` into
- an element with id `count` initially reading `0 tasks left`
- HTML comments at the five `commentAnchor` locations (`TASK: list name`, `TASK: starter tasks`,
  `TASK: save tasks`) so the editor highlighting in `app/editor/[id]/EditorLayout.tsx` has
  something to find.

Without that file, `getLessonForProject` and the task panel would work status-wise (the lesson
object is valid), but the checks can never be satisfied on a real project, and — as the test run
below shows — the check-integrity test suite can't even load the starter file to verify itself.

## Test result

Command: `bunx jest __tests__/unit/lib/task-checks.test.ts __tests__/unit/lib/lesson-copy.test.ts`

**`lesson-copy.test.ts`: PASS (4/4).** Confirms the word-budget trimming worked — total reading
load is 1378/1400 words, every chip/success/label/hint/brief is inside its per-string budget,
and no banned vocabulary was used.

**`task-checks.test.ts`: 24/28 PASS, 4 FAIL.** All 4 failures are `ENOENT: no such file or
directory, open '.../public/templates/todo-list.html'` — the four tests that read a lesson's
template file from disk (`readTemplate(lesson.templateFile)`) throw before any assertion runs,
because I didn't create that file (as instructed). Every test that doesn't touch the filesystem
passes, including the ones that check the lesson object's own shape: task-check coverage,
`sourceMatches` examples present, and homework-has-checks. Full raw output is in
`test-results.txt` next to this file.

**Bottom line:** the lesson definition is structurally sound and passes every check the test
suite can run without a template file, and it fits the reading-level budget. The remaining gap
is entirely the (expected, called out up front) missing `public/templates/todo-list.html` —
once that's authored to match the starter strings/selectors above, all 28 tests should pass.
