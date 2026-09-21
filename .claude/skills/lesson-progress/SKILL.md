---
name: lesson-progress
description: How a student's lesson progress is made and verified end to end — catalog resolution (`getLessonForProject`, `CURRENT_LESSON_VERSION = 3`), the check kinds (`sourceMatches` static; `outputContains`/`worldContains`/`callReturns` runtime in Pyodide), `runTaskChecks`, the tutor-judged completion path (`task_complete` tool → turn-route guard → `verifyTask` static floor on stored code → `recordTaskDone` in `lib/task-progress.ts`, the only writer that grows `lesson_progress`, plus the `task_progress` audit row), task gating (`isTaskLocked`, `isTaskOpen`, `pendingCoreTask`, `awaitingEditor`), the `lesson_progress` routes (GET / shrink-only PUT), the board's `task.complete` SSE flow, lesson availability (`class_enabled_lessons`), project creation and autosave (`/api/projects`), and homework submit/review (`submission_status`, teacher `messages`). Use for anything mentioning lesson progress, task, check, verify, complete, task_complete, completed_task_ids, lesson_progress, task_progress, evidence, hasRun, stale run, done, locked, gate, next task, homework, submit, hand in, review, approved, needs_work, submission_status, enabled lessons, "not open yet", start/resume lesson, project creation, autosave, PATCH projects, runtime verdict, 409. Use this before exploring `lib/task-*.ts`, `app/api/projects/`, `hooks/use*Progress*`, `lib/lesson-availability.ts`, `lib/lesson-files.ts` — it already maps them.
---

# Lesson progress: checks → evidence → tutor verdict → record

**The tutor decides a task is done; the server records it.** Checks are a rubric for the tutor
and a live checklist for the student; the browser never completes anything. The tutor calls
`task_complete`, the turn route guards it, `recordTaskDone` writes it (`ai-tutor` has the
prompt/tool side). Authoring a lesson (tasks, checks, templates, word budgets) is the
`lesson-authoring` skill; XP and streak derived from progress is `xp-and-streak`.

## Files

| Path                                                                    | What it holds                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/lessons.ts`                                                        | `Lesson`, `LessonTask`, `LessonTaskType = core                                                                                                                                                                                                                      | choice                                                                                                                                                  | bonus | homework`, `CURRENT_LESSON_VERSION = 3`, `LESSONS = PY_LESSONS`, `getLessonForProject(lessonId, lessonVersion)`→`null` unless version 3. |
| `lib/task-checks.ts`                                                    | `TaskCheck` union, `RuntimeVerdicts = (boolean                                                                                                                                                                                                                      | undefined)[]`(by check index),`isRuntimeCheck`, `runTaskChecks(checks, code, verdicts) → TaskCheckResult[]`(sync),`allChecksPassed`, `firstUnmetCheck`. |
| `lib/python-checks.ts`                                                  | `runPythonChecks(checks, files, entry, exec) → RuntimeVerdicts`; `PyExec` interface; `PyUnavailable`. Browser exec: `lib/python-check-client.ts` `workerExec` (hidden worker, 5s).                                                                                  |
| `lib/task-verify.ts`                                                    | `taskCode(board, files, entry, task)` (page code → board code → `files[entry]`), `verifyTask(task, code, reported) → { results, passed, failed }` — the static floor.                                                                                               |
| `lib/task-evidence.ts`                                                  | `Program { file, source, stdout, stale }`, `taskPrograms(board, task, entry, run?)`, `hasRun` (a run of the exact current source), `outputVerdict`, `describeEvidence`, `describeStep`, `describeTaskState` — the EVIDENCE / TASK STATE blocks the tutor reads.     |
| `lib/task-progress.ts`                                                  | `recordTaskDone(projectId, userId, taskId, { reason, programs })` — **the only writer that grows `lesson_progress`**; one transaction with the `task_progress` audit row; idempotent; invalidates the cache; `recordActivity`.                                      |
| `lib/task-guard.ts`                                                     | `pendingCoreTask(lesson, done)` (first unfinished `core`/`homework`), `isTaskLocked(tasks, index, doneSet)`, `homeworkTasks`, `homeworkComplete`, `CONCEPT_PHASE_NUDGE`, plus the tutor nudge helpers.                                                              |
| `lib/board/tasks.ts`                                                    | `isTaskOpen(lesson, index, done)` — homework opens only when every core task is done; `taskPageId`, `taskCodeNodeId`, `taskFile`, `taskStarter`, `awaitingEditor(board, task, pageId)` (concept steps still showing → task code is `''`, `task_complete` withheld). |
| `lib/lesson-project.ts`                                                 | `getLessonProject(projectId, userId)` — owner-scoped project + resolved lesson. **No live caller** since the complete route went (dead file).                                                                                                                       |
| `lib/lesson-files.ts`, `lib/lessons/templates.ts`                       | `lessonFiles(lesson)` builds a new project's files server-side from `TEMPLATES` (`templateFor(key)`); nothing the client sends is used.                                                                                                                             |
| `lib/starter-file.ts`                                                   | `entryFileFor(lesson, _files)` → `lesson.starterFile ?? 'main.py'` (second arg unused).                                                                                                                                                                             |
| `lib/lesson-availability.ts`                                            | `getEnabledLessonIdsForUser(userId) → Set<number>` — `class_members(role='student') ⋈ class_enabled_lessons`, cached 60s, DB error → empty set.                                                                                                                     |
| `app/api/projects/route.ts`                                             | GET list · POST create · PATCH autosave · DELETE.                                                                                                                                                                                                                   |
| `app/api/projects/[id]/lesson-progress/route.ts`                        | GET, PUT (shrink only). No route adds an id — that is `task_complete` inside `app/api/projects/[id]/turn/route.ts` (below).                                                                                                                                         |
| `app/api/projects/[id]/submit/route.ts`                                 | Homework hand-in.                                                                                                                                                                                                                                                   |
| `app/api/admin/homework/[id]/review/route.ts`                           | Teacher/admin review. UI: `components/dashboard/HomeworkReviewTable.tsx` from `app/staff/homework/HomeworkClient.tsx` (admin queue) and `app/staff/classes/[id]/TeacherClassClient.tsx`.                                                                            |
| `app/api/admin/classes/[id]/lessons/route.ts`                           | Teacher enables/disables a lesson for a class (`LessonsPanel.tsx`).                                                                                                                                                                                                 |
| `app/lessons/page.tsx` + `LessonsClient.tsx`, `app/lessons/[id]/`       | Roadmap: Start (`POST /api/projects { lessonId }` → `/board/<id>`), Resume, "Not open yet".                                                                                                                                                                         |
| `hooks/useRuntimeChecks.ts`, `useTaskChecks.ts`, `useLessonProgress.ts` | Board-side checklist + `applyDone(ids)` / `resetProgress` / `submitHomework` (flow below).                                                                                                                                                                          |

## Checks

| Kind                                               | Where it runs                                   | Passes when                                                                       |
| -------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `sourceMatches { pattern, flags?, min?, example }` | regex on the task's code, client **and server** | ≥ `min ?? 1` matches (`g` forced). Invalid regex → **passes** (fail open).        |
| `outputContains { pattern, inputs?, file? }`       | Pyodide, client only                            | program exits ok and stdout matches                                               |
| `worldContains { pattern, inputs?, file? }`        | Pyodide                                         | `worldTranscript(sparky events)` matches (`say:`, `color:`, `door:open`, `alarm`) |
| `callReturns { call, equals, file? }`              | Pyodide                                         | file imported (not `__main__`), `repr(eval(call)) === equals`                     |

`runTaskChecks` treats a runtime check as `verdict ?? false`. `runPythonChecks` returns `true`
for a bad pattern or when Pyodide is unavailable (fail open — a broken check must never
dead-end a child). On the server, `outputVerdict` answers `outputContains` checks from the
reported run's stdout; `worldContains`/`callReturns` are left to the tutor's judgement.

## Gating

- `isTaskLocked`: core locked while an earlier core is unfinished; choice/bonus locked while
  _any_ core is unfinished; homework never locked here.
- `isTaskOpen`: homework open only when all core tasks are done (this is the homework gate the
  board page rail uses).
- `pendingCoreTask` gates the tutor on `['core','homework']` in catalog order.
- `awaitingEditor`: while a task's concept steps are still showing there is no editor, the
  task's code is `''` (never the `boardCode` fallback) and `task_complete` is withheld.
- Optional tasks (`choice`/`bonus`) are skippable on the board so they can't wall off homework.

## Routes

**GET `lesson-progress`** → `{ completedTaskIds }` (empty if no row). 401 / 404 (not owned, no
lesson, wrong version).

**PUT `lesson-progress` `{ completedTaskIds }`** — may only **shrink**: 400 on unknown ids;
**409 `Use the complete endpoint to finish a task`** if any id is new; upserts + `updatedAt`;
`invalidate('lesson-progress:<id>')`; records no activity. Only caller: `resetProgress()` with `[]`.

**`task_complete { taskId, reason }` (tutor tool; `onTaskComplete` in `app/api/projects/[id]/turn/route.ts`)**

1. `openTask = pendingCoreTask(lesson, completed_task_ids)`; `programs = taskPrograms(board, openTask, entry, run)`
   where `run` is this turn's `code_run_result` event, if it is one.
2. `canComplete = !awaitingEditor(...)` — the tool is withheld (`toolsFor(lesson, canComplete)`) in the concept phase.
3. Refusals (thrown → handed back to the model as an `error:` tool result, nothing written):
   - `no task is open`; `taskId !== openTask.id`;
   - `!hasRun(programs)` — no run of the **exact** current source ("I'm done" alone never counts; an
     edit after Run makes the program _stale_);
   - `verifyTask(openTask, code, verdicts)` fails — static `sourceMatches` re-run on the **stored**
     board, `outputContains` answered from the reported stdout, other runtime kinds left `undefined`
     (the tutor judged them) → `not finished: <hint>`.
4. `recordTaskDone(id, user.id, taskId, { reason, programs })`: `SELECT … FOR UPDATE`; already
   done → return the list unchanged; else upsert `[...done, taskId]` + insert `task_progress`
   `{ reason ≤ 200 chars, code {file: source}, output {file: stdout}, judged_by 'tutor' }` in one
   transaction; `invalidate('lesson-progress:<id>')`; `recordActivity(user.id)` (errors swallowed).
5. The turn streams `{ type: 'task.complete', taskId, completedTaskIds }`; the tool result tells
   the model the screen advances by itself.

**POST `/api/projects` `{ lessonId, title? }`** — 404 unknown lesson; **403 unless
admin/teacher or `lessonId` ∈ enabled set**; `files = lessonFiles(lesson)` built on the server
from `lib/lessons/templates.ts` (a `starter`/`extraFiles` in the body is ignored — students can
neither forge nor fetch starters); inserts with `lessonVersion: CURRENT_LESSON_VERSION`;
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
   A task with `steps` first shows them one at a time (client-graded, no LLM call; see `ai-tutor`).
2. `useRuntimeChecks` (800ms debounce, hidden worker) → `{ taskId, verdicts }`; `useTaskChecks`
   → `{ results, evaluated, satisfied }` (drives the `TaskHeader` checklist only).
3. Student presses Run → `code_run_result` event (exact source + stdout) → tutor turn with the
   EVIDENCE + TASK STATE blocks; the tutor calls `task_complete` when every requirement is met.
4. Turn route guards + `recordTaskDone` (above) → `task.complete` SSE event; `useTutor` applies
   it **after** the stream ends (so the client's next-page save is not overwritten by the
   server's end-of-turn board write) → `useLessonProgress.applyDone(ids)`.
5. `LiveBoard`: confetti (big when all tasks done), `advanceTo` opens the next unfinished task page
   (`taskStarter`, or the code carried forward), then a `task_advanced` tutor turn introduces it.
6. Homework page footer → `submit`; teacher reviews; `needs_work` unlocks resubmission.

Completion costs a tutor turn, so a student past the 50/hour rate limit cannot finish tasks
until it resets. The 90s "I am stuck — show me" escape hatch and "Skip this one" on optional
tasks are unchanged.

## Availability

A lesson is locked until a teacher enables it for the student's class (`class_enabled_lessons`,
toggled via `POST admin/classes/[id]/lessons { lessonId, enabled }` — `classes:manage` or
`isTeacherOfClass`). Admins and teachers see everything. The gate is enforced only at
**project creation**; an already-started project stays resumable if later disabled.
`app/lessons/[id]` does not gate (only the POST does). Cache is 60s TTL, no invalidation.

## Invariants

- Only `recordTaskDone` (via `task_complete`) adds a task id. If PUT could add one, the guard
  would be one request away from irrelevant.
- The static floor runs on the **stored** board, never on request code; `hasRun` demands a run of
  the exact current source, so typing alone never advances anything.
- stdout is browser-reported because Node cannot run Python; the model is told to check it
  against the source and the static floor is the hard backstop.
- `task_progress` and `lesson_progress.completed_task_ids` are written in one transaction:
  neither can exist without the other. `completed_task_ids` stays the read model.
- `lesson_version` pins the catalog; rows with 2/null resolve to no lesson, earn no XP, open
  as an empty board. Never edit catalog v3 in place (`lesson-authoring`).
- `lesson_progress.projectId` FK must stay on one line in the schema file — a test regexes it.

## Gotchas / stale comments

- `turn/route.ts` mentions `/api/generate` (gone) and "build mode"; `lib/lesson-project.ts` has no caller.
- `lib/task-guard.ts` `isTaskLocked` comment cites a `coreComplete` symbol that does not exist;
  the homework gate is `isTaskOpen` in `lib/board/tasks.ts`.
- `lesson-progress/route.ts` has a private copy of `getLessonProject` instead of importing `lib/lesson-project.ts`.
- `app/lessons/[id]/LessonDetailClient.tsx` strips a `Task N — ` prefix no chip has.
- `app/admin/homework/page.tsx` is a redirect to `/staff/homework`.

## Tests

- `__tests__/integration/api/task-complete.test.ts` — `task_complete` through the turn route: refused without a run / on a stale run / on the wrong task / when the static floor fails; writes `task_progress` + `lesson_progress` together; idempotent; activity recorded only on success.
- `__tests__/integration/api/lesson-progress.test.ts` — PUT cannot add, no activity, FK cascade regex.
- `__tests__/integration/api/projects.test.ts` — create (version pin, server-built files, body `starter` ignored, availability 403), PATCH ownership, `SavedBoard` 400.
- `__tests__/unit/lib/task-checks.test.ts`, `task-guard.test.ts`, `task-evidence.test.ts`, `python-checks.test.ts`, `board-tasks.test.ts`; `__tests__/unit/hooks/useLessonProgress.test.ts`; `__tests__/unit/components/BoardSteps.test.tsx`.
