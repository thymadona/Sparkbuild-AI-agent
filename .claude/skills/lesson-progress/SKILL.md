---
name: lesson-progress
description: How a student's lesson progress is made and verified end to end — catalog resolution (`getLessonForProject`, `CURRENT_LESSON_VERSION = 3`), the check kinds (`sourceMatches` static; `outputContains`/`worldContains`/`callReturns` runtime in Pyodide), `runTaskChecks`, `verifyTask` (server re-runs static checks on stored code, runtime verdicts are client-reported), task gating (`isTaskLocked`, `isTaskOpen`, `pendingCoreTask`), the `lesson_progress` routes (GET / shrink-only PUT / POST complete → 409 with hint), the board's auto-complete flow, lesson availability (`class_enabled_lessons`), project creation and autosave (`/api/projects`), and homework submit/review (`submission_status`, teacher `messages`). Use for anything mentioning lesson progress, task, check, verify, complete, completed_task_ids, lesson_progress, done, locked, gate, next task, homework, submit, hand in, review, approved, needs_work, submission_status, enabled lessons, "not open yet", start/resume lesson, project creation, autosave, PATCH projects, runtime verdict, 409. Use this before exploring `lib/task-*.ts`, `app/api/projects/`, `hooks/use*Progress*`, `lib/lesson-availability.ts` — it already maps them.
---

# Lesson progress: checks → verify → complete

Tasks are verified by code, the **server has the last word**, and the tutor is gated by the
same verdicts (`ai-tutor`). Authoring a lesson (tasks, checks, templates, word budgets) is the
`lesson-authoring` skill; XP and streak derived from progress is `xp-and-streak`.

## Files

| Path                                                                                          | What it holds                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/lessons.ts`                                                                              | `Lesson`, `LessonTask`, `LessonTaskType = core                                                                                                                                           | choice                                                                                                                                                                                                 | bonus | homework`, `CURRENT_LESSON_VERSION = 3`, `LESSONS = PY_LESSONS`, `getLessonForProject(lessonId, lessonVersion)`→`null` unless version 3. |
| `lib/task-checks.ts`                                                                          | `TaskCheck` union, `RuntimeVerdicts = (boolean                                                                                                                                           | undefined)[]`(by check index),`isRuntimeCheck`, `runTaskChecks(checks, code, verdicts) → TaskCheckResult[]`(sync),`allChecksPassed`, `firstUnmetCheck`, `highlightLinesForTask(code, anchor, checks)`. |
| `lib/python-checks.ts`                                                                        | `runPythonChecks(checks, files, entry, exec) → RuntimeVerdicts`; `PyExec` interface; `PyUnavailable`. Browser exec: `lib/python-check-client.ts` `workerExec` (hidden worker, 5s).       |
| `lib/task-verify.ts`                                                                          | `taskCode(board, files, entry, task)` (page code → board code → `files[entry]`), `verifyTask(task, code, reported) → { results, passed, failed }`.                                       |
| `lib/task-guard.ts`                                                                           | `pendingCoreTask(lesson, done)` (first unfinished `core`/`homework`), `isTaskLocked(tasks, index, doneSet)`, `homeworkTasks`, `homeworkComplete`, plus the tutor nudge helpers.          |
| `lib/board/tasks.ts`                                                                          | `isTaskOpen(lesson, index, done)` — homework opens only when every core task is done; `taskPageId`, `taskCodeNodeId`, `taskFile`.                                                        |
| `lib/lesson-project.ts`                                                                       | `getLessonProject(projectId, userId)` — owner-scoped project + resolved lesson (used by complete route).                                                                                 |
| `lib/starter-file.ts`                                                                         | `entryFileFor(lesson, _files)` → `lesson.starterFile ?? 'main.py'` (second arg unused).                                                                                                  |
| `lib/lesson-availability.ts`                                                                  | `getEnabledLessonIdsForUser(userId) → Set<number>` — `class_members(role='student') ⋈ class_enabled_lessons`, cached 60s, DB error → empty set.                                          |
| `app/api/projects/route.ts`                                                                   | GET list · POST create · PATCH autosave · DELETE.                                                                                                                                        |
| `app/api/projects/[id]/lesson-progress/route.ts`                                              | GET, PUT (shrink only).                                                                                                                                                                  |
| `app/api/projects/[id]/lesson-progress/complete/route.ts`                                     | POST — the only way a task id is added.                                                                                                                                                  |
| `app/api/projects/[id]/submit/route.ts`                                                       | Homework hand-in.                                                                                                                                                                        |
| `app/api/admin/homework/[id]/review/route.ts`                                                 | Teacher/admin review. UI: `components/dashboard/HomeworkReviewTable.tsx` from `app/staff/homework/HomeworkClient.tsx` (admin queue) and `app/staff/classes/[id]/TeacherClassClient.tsx`. |
| `app/api/admin/classes/[id]/lessons/route.ts`                                                 | Teacher enables/disables a lesson for a class (`LessonsPanel.tsx`).                                                                                                                      |
| `app/lessons/page.tsx` + `LessonsClient.tsx`, `app/lessons/[id]/`                             | Roadmap: Start (fetch templates → POST project → `/board/<id>`), Resume, "Not open yet".                                                                                                 |
| `hooks/useRuntimeChecks.ts`, `useTaskChecks.ts`, `useAutoComplete.ts`, `useLessonProgress.ts` | Board-side completion plumbing (flow below).                                                                                                                                             |

## Checks

| Kind                                               | Where it runs                                   | Passes when                                                                       |
| -------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `sourceMatches { pattern, flags?, min?, example }` | regex on the task's code, client **and server** | ≥ `min ?? 1` matches (`g` forced). Invalid regex → **passes** (fail open).        |
| `outputContains { pattern, inputs?, file? }`       | Pyodide, client only                            | program exits ok and stdout matches                                               |
| `worldContains { pattern, inputs?, file? }`        | Pyodide                                         | `worldTranscript(sparky events)` matches (`say:`, `color:`, `door:open`, `alarm`) |
| `callReturns { call, equals, file? }`              | Pyodide                                         | file imported (not `__main__`), `repr(eval(call)) === equals`                     |

`runTaskChecks` treats a runtime check as `verdict ?? false`. `runPythonChecks` returns `true`
for a bad pattern or when Pyodide is unavailable (fail open — a broken check must never
dead-end a child). A task with no checks is never auto-completed.

## Gating

- `isTaskLocked`: core locked while an earlier core is unfinished; choice/bonus locked while
  _any_ core is unfinished; homework never locked here.
- `isTaskOpen`: homework open only when all core tasks are done (this is the homework gate the
  board page rail uses).
- `pendingCoreTask` gates the tutor on `['core','homework']` in catalog order.
- Optional tasks (`choice`/`bonus`) are skippable on the board so they can't wall off homework.

## Routes

**GET `lesson-progress`** → `{ completedTaskIds }` (empty if no row). 401 / 404 (not owned, no
lesson, wrong version).

**PUT `lesson-progress` `{ completedTaskIds }`** — may only **shrink**: 400 on unknown ids;
**409 `Use the complete endpoint to finish a task`** if any id is new; upserts + `updatedAt`;
`invalidate('lesson-progress:<id>')`; records no activity. Only caller: `resetProgress()` with `[]`.

**POST `lesson-progress/complete` `{ taskId, runtimeVerdicts? }`**

1. 401; `getLessonProject` → 404.
2. Unknown `taskId` → 400.
3. Already done → 200 `{ completedTaskIds, alreadyDone: true }`.
4. `isTaskLocked || !isTaskOpen` → 409 `Finish the task before this one first`.
5. `verifyTask(task, taskCode(project.board, files, entry, task), reported)` — static checks are
   re-run on the **stored** board, never on request code; a reported verdict is applied **only
   to a runtime slot** (`reported[i]` for `isRuntimeCheck`), so a client cannot wave a static
   check through. Fail → 409 `{ error: failed.hint, check: failed.label, results }`.
6. Upsert `[...completed, taskId]`, `updatedAt = now`; `invalidate('lesson-progress:<id>')`;
   `recordActivity(user.id)` (streak, errors swallowed); 200 `{ completedTaskIds }`.

**POST `/api/projects` `{ lessonId, starter, extraFiles?, title? }`** — client fetched the
templates (`lib/lesson-files.ts` → `/templates/<templateFile>`); 404 unknown lesson; **403 unless
admin/teacher or `lessonId` ∈ enabled set**; files = `{ [starterFile]: starter }` + only the
`extraFiles` names the lesson declares; inserts with `lessonVersion: CURRENT_LESSON_VERSION`;
201 with snake_case columns. **PATCH `{ id, title?, is_public?, files?, board? }`** — `board`
must pass `SavedBoard.safeParse` (400); owner-scoped → 404. **DELETE `?id=`** deletes
`messages`, `prompts`, then the project (the `prompts` FK is NO ACTION).

**POST `submit`** — 404 no lesson; 400 lesson has no homework; already `submitted`/`approved`
→ 200 unchanged; `!homeworkComplete` → 409 `Finish your homework tasks first`; sets
`submission_status = 'submitted'`. `needs_work` may resubmit.

**POST `admin/homework/[id]/review` `{ status: 'approved'|'needs_work', feedback? }`** —
`isAdmin || hasPermission('homework:review')` → 403; `needs_work` requires feedback (400);
not handed in → 409; non-admins must teach a class the student is in (`getTeacherClassIds` +
`class_members.role='student'`) → 403; transaction: update status + insert
`messages { role: 'teacher', userId: student, content: feedback }`. The tutor sees that row as a
plain user message (`ai-tutor`).

`SubmissionStatus = 'submitted' | 'approved' | 'needs_work'` (`types/index.ts`); `null` = not
handed in; DB check constraint matches.

## Board flow (student finishes a task)

1. `LiveBoard`: `viewedTask = taskForPageId(lesson, currentPageId)`; `code = pageCode(board, page)`.
2. `useRuntimeChecks` (800ms debounce, hidden worker) → `{ taskId, verdicts }`; `useTaskChecks`
   → `{ results, evaluated, satisfied }` (drives `TaskHeader` checklist).
3. `useAutoComplete` (`SETTLE_MS = 800`, once per `(taskId, code)`) → `markDone(index)`.
4. `useLessonProgress.markDone`: `beforeComplete()` = autosave PATCH (server judges stored
   code) → `POST complete { taskId, runtimeVerdicts }` → on 409 shows the hint in the header.
5. 200 → `done` set, confetti (big when all tasks done), `advanceTo` opens the next unfinished
   task page with the code carried forward, then a `task_advanced` tutor turn.
6. Homework page footer → `submit`; teacher reviews; `needs_work` unlocks resubmission.

## Availability

A lesson is locked until a teacher enables it for the student's class (`class_enabled_lessons`,
toggled via `POST admin/classes/[id]/lessons { lessonId, enabled }` — `classes:manage` or
`isTeacherOfClass`). Admins and teachers see everything. The gate is enforced only at
**project creation**; an already-started project stays resumable if later disabled.
`app/lessons/[id]` does not gate (only the POST does). Cache is 60s TTL, no invalidation.

## Invariants

- Only `complete` adds a task id. If PUT could add one, verification would be one request away
  from irrelevant.
- Server verifies **stored** code; callers must flush (`beforeComplete`) first.
- Runtime verdicts are client-reported because Node cannot run Python. They are trusted only
  for runtime checks.
- `lesson_version` pins the catalog; rows with 2/null resolve to no lesson, earn no XP, open
  as an empty board. Never edit catalog v3 in place (`lesson-authoring`).
- `lesson_progress.projectId` FK must stay on one line in the schema file — a test regexes it.

## Gotchas / stale comments

- `complete/route.ts` and `turn/route.ts` mention `/api/generate` (gone) and "build mode".
- `lib/task-guard.ts` `isTaskLocked` comment cites a `coreComplete` symbol that does not exist;
  the homework gate is `isTaskOpen` in `lib/board/tasks.ts`.
- `lesson-progress/route.ts` has a private copy of `getLessonProject` instead of importing `lib/lesson-project.ts`.
- `app/lessons/[id]/LessonDetailClient.tsx` strips a `Task N — ` prefix no chip has.
- `app/admin/homework/page.tsx` is a redirect to `/staff/homework`.

## Tests

- `__tests__/integration/api/lesson-complete.test.ts` — refuses unfinished stored code with the failing part, refuses missing runtime verdict, ignores client-claimed static pass, ordering, homework gate, idempotent, foreign/401, activity recorded only on success.
- `__tests__/integration/api/lesson-progress.test.ts` — PUT cannot add, no activity, FK cascade regex.
- `__tests__/integration/api/projects.test.ts` — create (version pin, extraFiles whitelist, availability 403), PATCH ownership, `SavedBoard` 400.
- `__tests__/unit/lib/task-checks.test.ts`, `task-guard.test.ts`, `python-checks.test.ts`, `board-tasks.test.ts`; `__tests__/unit/hooks/useAutoComplete.test.tsx`, `useLessonProgress.test.ts`.
