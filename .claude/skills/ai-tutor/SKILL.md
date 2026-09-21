---
name: ai-tutor
description: How the AI tutor ("Spark") and the board are implemented — DeepSeek via the `openai` SDK (`lib/deepseek.ts`, model pinned to `deepseek-v4-flash`), the three system-prompt layers (`TUTOR_PROMPT`, `lessonLayer`, `buildTaskNudge`), the `ClientEvent` union, `runTurn`'s tool-call loop, the board schema/tools/reducer (`board_add`, `board_update`, `board_remove`, `board_focus`, `request_trace`, `board_new_page`), the SSE contract of `POST /api/projects/[id]/turn`, `LiveBoard`/`useTutor` client state, autosave, task pages, the 90s "I am stuck" button, and Python-in-the-browser (Pyodide `py-worker.js`, `py-runtime.py`, `sparky`, trace). Use for anything mentioning tutor, Spark, AI, LLM, DeepSeek, prompt, system prompt, persona, caption, turn, tool call, board, node, page, reducer, SSE, stream, LiveBoard, useTutor, mascot, nudge, escalation, hint, stuck, run code, Pyodide, worker, trace, code_run, teacher feedback to the tutor, director/build mode. Use this before exploring `lib/tutor/`, `lib/board/`, `app/board/`, `app/api/projects/[id]/turn`, `hooks/usePythonRunner.ts`, `public/py-*` — it already maps them.
---

# AI tutor and board

The LLM contract is **tool calls on a board, not generated files**. Spark speaks in short
plain-text captions and mutates a zod-validated `BoardState`; the student's code is an editable
code node per task page; `lib/board/code.ts` projects the board back into `projects.files`.
Model: `deepseek-v4-flash`, native DeepSeek API, pinned for cost — **no provider/model change
without approval.** Python runs only in the browser.

## Files

| Path                                                                                                            | What it holds                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/deepseek.ts`                                                                                               | `MODEL = 'deepseek-v4-flash'`; `deepseek = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey })`. Nothing else.                                                                                                                                                                                                                                                                                                                                   |
| `lib/tutor/prompt.ts`                                                                                           | `TUTOR_PROMPT` (persona + rules), `lessonLayer(lesson, boardSummary, openTask?)` (lesson title/description, task list with `[done]/[OPEN]/[not started]`, `CURRENT BOARD`, then `TASK_PAGE_RULE` in a lesson or `PAGE_RULE` free-form).                                                                                                                                                                                                                  |
| `lib/task-guard.ts`                                                                                             | **`buildTaskNudge(task, tier, results)`** (the third prompt layer: chip/goal, DONE / NOT DONE YET per check, never-write-code rules, `commentAnchor` pointer, escalation text), `pendingCoreTask`, `escalationTier(stuckTurns, confused, isHomework)` → 1                                                                                                                                                                                                | 2          | 3 (homework caps at 2), `detectConfusion`. |
| `lib/tutor/events.ts`                                                                                           | `ClientEvent` zod union: `session_start`, `student_message {text ≤1000}`, `code_run_result {nodeId, source, ok, stdout, stderr}`, `trace_result {nodeId, source, steps}`, `task_advanced {done, next, pageId}`. `applyClientEvent(board, ev) → { board, content, saveText? }` — applies `runOps`/`traceOps` for run/trace events and renders the `<student_event …>` user message. Only `student_message` yields `saveText` (persisted as a `user` row). |
| `lib/tutor/turn.ts`                                                                                             | `runTurn({ llm, messages, board, emit }) → { board, text }`. Emits `TurnEvent`s. `MAX_RETRIES = 2`. No persistence.                                                                                                                                                                                                                                                                                                                                      |
| `lib/board/schema.ts`                                                                                           | `NodeId` (`^[A-Za-z0-9_]+$`, ≤64), `Lang = z.enum(['python'])`, `BoardNode` union: `heading`, `text` (markdown), `code {language, file?, source ≤4000, editable, highlightLines, caption?}`, `output`, `trace {steps ≤200, cursor}`, `preview` (dead), `quiz`, `diagram {kind: variable_boxes                                                                                                                                                            | list_boxes | flow                                       | loop_counter | call_stack}`. `BoardOp`: `add {pageId,node}`, `update {id,patch}`, `remove {id}`, `focus {id}`, `new_page {pageId,title ≤40}`. `CLIENT_ONLY_TYPES = ['output','trace','preview']`. |
| `lib/board/tools.ts`                                                                                            | `TOOLS` (OpenAI function tools): `board_add {pageId, node}`, `board_update {id, patch}`, `board_remove {id}`, `board_focus {id}`, `request_trace {nodeId}`, `board_new_page {pageId, title}`. `toolsFor(inLesson)` **drops `board_new_page`** in a lesson (the client owns task pages). `toOp(name, args)` strips `board_` and stamps `createdBy: 'tutor'`.                                                                                              |
| `lib/board/reducer.ts`                                                                                          | `BoardState { pages[{id,title,nodeIds}], activePageId, nodes, focusId }`, `emptyBoard()`, pure `apply(state, op, actor)` (throws readable errors that go back to the model: dup ids, unknown page/parent, tutor adding client-only types, bad patch), `remove` cascades by `parentId` and `forNodeId`, `summarize(state)` (page list + `id [type] first-40-chars`), `boardReducer`.                                                                      |
| `lib/board/code.ts`                                                                                             | `pageCode(board, pageId)` / `pageCodeNodeId`, `boardCode(board)` (main or last editable python node), `boardFiles(board, entry)`, `withBoardCode(files, entry, board)` (projection into `projects.files`), `boardFromFiles(source)` (legacy migration), **`SavedBoard`** zod (pages ≤20) used by `PATCH /api/projects`.                                                                                                                                  |
| `lib/board/run.ts`                                                                                              | `runOps(board, nodeId, result)` → update source + add/update `out_<nodeId>`; `traceOps(...)` → `trace_<nodeId>`.                                                                                                                                                                                                                                                                                                                                         |
| `lib/board/tasks.ts`                                                                                            | `taskPageId(task) = 't_' + id`, `taskForPageId`, `taskIndexForPageId`, `taskCodeNodeId = 'code_' + id`, `taskFile(task, entry)`, `isTaskOpen` (homework only when all core done).                                                                                                                                                                                                                                                                        |
| `app/api/projects/[id]/turn/route.ts`                                                                           | The turn endpoint (below).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `app/board/[id]/page.tsx`                                                                                       | Server: owner-scoped project, last assistant caption, lesson, `lesson_progress`, class schedule slots; migrates a board-less project via `boardFromFiles` if its entry file differs from the template. Renders `LiveBoard`.                                                                                                                                                                                                                              |
| `app/board/LiveBoard.tsx`                                                                                       | Client state (below). `app/board/useTutor.ts` (SSE client), `BoardView.tsx` (page rail, captions, chat input), `Nodes.tsx` (`NodeView`, CodeMirror via `components/CodeEditor.tsx`), `TaskHeader.tsx`, `HomeworkFooter.tsx`, `Mascot.tsx`.                                                                                                                                                                                                               |
| `app/board/page.tsx`, `BoardClient.tsx`, `fixture.ts`                                                           | Leftover Phase-1 scripted demo at `/board`. Not part of the live flow.                                                                                                                                                                                                                                                                                                                                                                                   |
| `hooks/usePythonRunner.ts`                                                                                      | Spawns `/py-worker.js`; `run(files, entry, inputs)`, `trace(source)`, `stop`, `sendInput` (SharedArrayBuffer — needs `crossOriginIsolated`), `status`, `output`, `world`. `RUN_TIMEOUT_MS = 10_000` → terminate + respawn.                                                                                                                                                                                                                               |
| `public/py-worker.js`                                                                                           | Pyodide 0.27.7 from CDN + `public/py-runtime.py`. Messages: `init`, `run`, `check`, `trace`; replies `ready`, `out`, `err`, `input`, `done`, `traced`, `fatal`.                                                                                                                                                                                                                                                                                          |
| `public/py-runtime.py`                                                                                          | `sparky` module (`color`, `open_door`, `close_door`, `alarm`; prints become `say` events, cap 300), `_run(entry)`, `_call(entry, expr)`, `_trace(entry)` (`sys.settrace`, 200 steps: line, stdout tail, call stack, ≤10 vars).                                                                                                                                                                                                                           |
| `lib/sparky-events.ts`                                                                                          | `worldTranscript(events)` → `say:…\ncolor:…\ndoor:open\nalarm`; `worldState`.                                                                                                                                                                                                                                                                                                                                                                            |
| `lib/python-checks.ts`, `lib/python-check-client.ts`                                                            | Runtime checks run on a **second hidden worker** (`workerExec`, 5s timeout, serialized) so Run/Stop never interferes. See `lesson-progress`.                                                                                                                                                                                                                                                                                                             |
| `hooks/useAutoComplete.ts`, `hooks/useLessonProgress.ts`, `hooks/useTaskChecks.ts`, `hooks/useRuntimeChecks.ts` | Task completion plumbing — `lesson-progress` skill.                                                                                                                                                                                                                                                                                                                                                                                                      |

## Prompt: what the model sees

`system = [TUTOR_PROMPT, lessonLayer(lesson, summarize(board), openTask), nudge].join('\n\n')`
then the last **10** `messages` rows (assistant → `assistant`; `user` **and `teacher`** rows →
`user`), then the event's rendered content. The model never sees full code directly — only the
40-char node summary plus the nudge's per-check verdicts; it reads code by asking for a trace or
from the student's message. `TUTOR_PROMPT` rules: ≤2 sentences + ≤1 board change per turn, end
with a question, hint ladder (question → highlighted line → tiny example → partial skeleton),
never a full solution before two attempts, never overwrite student-edited source (add a node),
captions are plain text (no markdown), only ids from the summary or new `[A-Za-z0-9_]` ids,
cannot create `output`/`trace`/`preview`. `TASK_PAGE_RULE`: never say a task is finished or
announce the next one — the client does that when the checks pass.

## One turn, end to end (`POST /api/projects/[id]/turn`, `runtime = 'nodejs'`)

1. `getSessionUser()` → 401. `isUuid(id)` → 404.
2. `isAdmin || isTeacher` bypass, else `checkRateLimit` → 429 (`redis-cache-ratelimit`).
3. `ClientEvent.safeParse(body)` → 400 `Invalid event`. Sidecar `body.runtimeChecks?: { taskId, verdicts }` read raw.
4. Owner-scoped select of `projects { board, files, lessonId, lessonVersion }` → 404.
5. Last 10 `messages` (chronological).
6. `applyClientEvent(board ?? emptyBoard(), event)` → 400 on a bad event (unknown nodeId).
7. `getLessonForProject`; if a lesson: `cached('lesson-progress:<id>', 15s)` → `pendingCoreTask`;
   verdicts accepted only when `runtimeChecks.taskId === openTask.id`;
   `runTaskChecks(openTask.checks, pageCode(board, taskPageId(openTask)) ?? '', verdicts)`;
   `stuckTurns` = assistant messages since `lesson_progress.updated_at`; `escalationTier`; `buildTaskNudge`.
8. `deepseek.chat.completions.create({ model: MODEL, stream: true, tools: toolsFor(!!lesson), messages, thinking: { type: 'disabled' } })`.
9. Response is `text/event-stream`, one `data: <TurnEvent JSON>` per frame:
   `agent.state {thinking|speaking|idle}`, `caption.delta {text}`, `board.op {op}`,
   `trace.request {nodeId}`, `turn.end`, `error {message}`. Always HTTP 200; failures arrive as `error`.
10. `runTurn`: stream text → `caption.delta`; accumulate tool calls; each → `toOp` → `apply(board, op, 'tutor')` → `board.op` (or `trace.request` for `request_trace`, after verifying a python code node). A throwing op becomes a tool result `error: …\nBoard now: <summary>` and the model is re-called, up to 2 retries. Spoken text across attempts is concatenated.
11. Persist: `projects.board = result.board`, `projects.files = withBoardCode(files, entryFileFor(lesson), result.board)`, `updatedAt` (owner-scoped update).
12. `messages`: `{role:'user', content: saveText}` only for `student_message`; `{role:'assistant', content: result.text}` when non-empty.
13. `prompts { userId, projectId, content, context: { tutor: 'board', system } }` (errors swallowed).

## Client model (`LiveBoard.tsx`)

- `useReducer(boardReducer, initialBoard)`; `useTutor(projectId, dispatch, …)` posts events, applies `board.op` frames with `actor: 'tutor'`, tracks `live` caption and `mascot`; **single-slot queue** — an event sent mid-turn waits, a second one replaces it.
- `code = pageCode(board, currentPageId) ?? boardCode(board) ?? ''` — **`pageCode`, not `boardCode`**, or an open task would see a later page's code.
- **Autosave, no Save button**: `PATCH /api/projects { id, board, files: withBoardCode(...) }` 1200ms after any board change, **suppressed while a turn is in flight**; also flushed by `beforeComplete` before a task is recorded done. Server validates `board` with `SavedBoard.safeParse` → 400. `CodeEditor` emits after 300ms typing and must keep adopting external `code` while ignoring the echo of its own emission (`lastEmitted`), or a tutor edit mid-keystroke is lost.
- **One page per task**: `openPageFor(task)` dispatches `new_page t_<id>` + `add code_<id>` (student-owned, code carried from the finished page, `file` set for non-entry files). `advanceTo` runs after `CONFETTI_MS = 1400`, then `send({ type: 'task_advanced' })` so Spark introduces the next task. No task list, no "Mark done".
- Run: `codeActions.run` → `py.run({...files, ...boardFiles(board), [file]: source}, file)`; when the worker goes idle, `runOps` are applied locally and `code_run_result` is sent. `code_run` prompt rule: react in one sentence, point at the line, don't fix.
- Trace: `trace.request` frames are run after `turn.end` via `py.trace(source)` → `traceOps` → `send({ type: 'trace_result' })`; `TraceNode` has a step slider whose cursor is saved on the next autosave.
- `TaskHeader`: live checklist from `useTaskChecks`; `STUCK_DELAY_MS = 90_000` on the same task → "I am stuck — show me" (sends a fixed `student_message`); `choice`/`bonus` tasks get "Skip this one" (client-only page jump, no server call). See `lesson-progress` for `useAutoComplete` (800ms settle) and the complete route.
- `HomeworkFooter` under the last homework page → `POST /api/projects/[id]/submit`.

## Invariants

- The tutor is gated by the same checks as the student: without the nudge it congratulates
  students whose checks have not passed. Keep `pendingCoreTask` + `buildTaskNudge` in the route.
- `board_new_page` stays withheld in lessons; the client owns `t_<taskId>` pages.
- `Lang` is `python` only; there is no preview/HTML node in practice.
- Director/build mode does not exist: `Lesson.aiPolicy` is declared but the route never reads it.
  A future director mode belongs in this route + `toolsFor`, not in a per-user toggle.

## Gotchas / stale code and comments

- **Teacher feedback reaches the model as a plain `user` message.** `messages.role = 'teacher'`
  rows (written by the homework review route) are mapped to `role: 'user'` with the raw text —
  the old `My teacher said: …` relay went away with `/api/generate`. `HomeworkFooter` still says
  "Spark can read it to you". If you want attribution, prefix in the history mapping in the turn route.
- Comments citing `/api/generate`, "build mode" or the "Mark done button" (`turn/route.ts`,
  `lib/task-guard.ts`, `lib/tutor/prompt.ts` PAGE_RULE, `hooks/useLessonProgress.ts`) describe removed UI.
- `turn/route.ts` says the lesson-progress PUT is the sole writer of `updated_at`; the complete
  route also writes it, so `stuckTurns` resets on every completion.
- Dead: `preview` node type; `flow`/`loop_counter`/`call_stack` diagram kinds render nothing
  (`Nodes.tsx`); quiz options are not clickable (no `quiz_answer` event); `/board` fixture demo;
  `components/SparkyWorld.tsx` / `components/PythonRunner.tsx` (no caller — the board does not draw the world yet).
- `lib/board/run.ts` uses `pageId!`; a code node on no page yields `Unknown page undefined` → 400.
- After the final failed retry, `runTurn` computes tool results it never sends.

## Tests

- `__tests__/unit/lib/tutor-turn.test.ts` — streaming, retry on bad op, refuses output nodes, tool JSON never mentions client-only types.
- `__tests__/integration/api/turn.test.ts` — real DB + mocked DeepSeek: persistence, 401/404/429, `code_run_result` updates node/output/files, nudge shows DONE/NOT DONE YET, `board_new_page` withheld in lessons.
- `__tests__/unit/lib/board-reducer.test.ts`, `board-code.test.ts`, `board-tasks.test.ts`, `board-trace.test.ts` (real Pyodide trace).
- `__tests__/unit/lib/task-guard.test.ts` — nudge tiers, homework answer withheld, `escalationTier`, `detectConfusion`.
- `__tests__/unit/lib/python-checks.test.ts`, `python-check-client.test.ts`, `sparky-events.test.ts`; `__tests__/unit/components/CodeEditor.test.tsx`.
- Pyodide under Node: `__tests__/helpers/pyodide.ts` (`nodeExec`), needs `NODE_OPTIONS=--experimental-vm-modules`.
