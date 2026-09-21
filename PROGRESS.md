# Tutor board progress

## Phase 0: foundations (done)

- Works: `lib/board/schema.ts` (Zod nodes + ops), `lib/board/reducer.ts` (pure `apply`, `summarize`), 4 Jest tests passing, `zod` added.
- Stubbed: nothing wired to UI or DB yet. `projects.board` column not added.
- Next: Phase 1, board screen driven by a scripted fixture.

## Phase 1: screen with a fake tutor (done)

- Works: `/board` (login required) replays `app/board/fixture.ts` end to end: captions stream word by word, nodes rise in, page tabs appear and switch, focus pulses, Spark mascot follows speaking/thinking, earlier captions and minimize work, Replay restarts. Checked at 1440 and 820 wide.
- Stubbed: code is a read-only `<pre>` (CodeMirror in Phase 3); composer input disabled; quiz is not clickable; nodes render flat (parentId nesting ignored); trace/preview nodes render nothing; no DB.
- Next: Phase 2, real tutor turn route.

## Phase 2: real tutor (done)

- Works: `POST /api/projects/[id]/turn` streams SSE (`caption.delta`, `board.op`, `agent.state`, `turn.end`, `error`). DeepSeek tool calling verified live (captions and tool calls interleave; valid ops). Bad calls go back as tool results, max 2 retries. Board saved to `projects.board`; captions to `messages`; turn logged to `prompts`. Auth, ownership predicate, `isUuid`, rate limit (staff bypass).
- Files: `lib/board/tools.ts`, `lib/tutor/{prompt,turn}.ts`, migration `0008` (adds `projects.board`). Tests: `tutor-turn.test.ts`, `api/turn.test.ts`.
- Stubbed: `/board` still plays the fixture (not wired to the route); client events other than `session_start`/`student_message` (code run, quiz answer) come in Phase 3; the task guard / escalation tiers and build-mode gating are not applied to board turns; `request_trace` tool is Phase 4. Migration 0008 applied to the test DB only.
- Next: Phase 3, runnable code.

## Phase 3: code you can run (done)

- Works: `/board/[id]` (owner only) is the live board for a project: greets on an empty board, Python nodes are CodeMirror editors (reusing `components/CodeEditor.tsx`, new `hideToolbar` prop) with Run/Stop and `input()` support on one shared Pyodide worker (`usePythonRunner`). A finished run writes the code's source and an output node (`lib/board/run.ts`, used by client and server), then sends `code_run_result`; the server applies the same ops, persists the board, and the tutor reacts. Errors show the last traceback line, full text under Details. Rejoin reloads the saved board. `/board` still plays the demo fixture.
- Also: turn route now takes a Zod-validated event union (`lib/tutor/events.ts`); prompt rules added for code_run events, no overwriting edited code, plain-text captions. Full suite: 397 passing.
- Stubbed / open: task checks and Mark done are not wired to the board (Phase 5 cutover); edits are saved only when the student runs or the tutor next turns, not on every keystroke; HTML/JS `preview` nodes not built; quiz options not clickable (no `quiz_answer` event yet); Python `input()` needs cross-origin isolation (as in the editor); dev DB migrated to 0008.
- Next: Phase 4, `request_trace` and TraceNode, plus variable_boxes/list_boxes diagrams driven by real data.

## Phase 4: visuals from real data (done, not yet walked in a browser)

- Works: the tutor's `request_trace` tool makes the server emit `trace.request`; after the turn the browser runs `_trace` (`sys.settrace`, max 200 steps, in `public/py-runtime.py` via a `trace` worker message and `usePythonRunner().trace`), adds/replaces `trace_<nodeId>` (`traceOps`), and sends `trace_result`, which the server applies and the tutor reacts to. `TraceNode` has a step slider, highlighted line, variable boxes, list cells, call stack and stdout so far. `variable_boxes`/`list_boxes` diagrams share the same `Boxes` renderer.
- Tests: `board-trace.test.ts` (real Pyodide trace, event, tool). Full suite: 404 passing; tsc and eslint clean on new code.
- Open: trace is Python only; a trace with `input()` ends at EOF; the slider cursor is saved on the next turn or run; no browser walkthrough yet.
- Next: Phase 5, pages + cutover.

## Phase 5: cutover (done, not yet walked in a browser)

- Works: `/editor/[id]` redirects Python-course projects (lesson_version ≥ 3) to `/board/[id]`; all 11 existing `/editor/...` links are untouched. HTML v2, legacy and free-form projects (forks from /explore) stay on the old editor, so **`app/editor` and `EditorLayout` are not deleted** (decision: keep, not re-litigate).
- Pages and rejoin were already live (Phases 1 and 3). New: a project with editor-era work and no board opens with that code seeded as node `main` (only when it differs from the untouched starter).
- Tasks and homework reuse `useLessonProgress` + `Navigator` in a "Tasks" side panel, so Mark done, runtime checks, gated homework, submit, XP/badges and streak work as before. Checks run against `boardCode(board)`: node `main`, else the newest editable Python node (`lib/board/code.ts`). Runs now include extra lesson files (e.g. `bugzap.py`).
- `projects.files[entry]` is kept in step with the board (turn route writes it; the client autosave PATCHes `board` + `files` 1.2s after an edit, never mid-turn), so share, fork and explore still see the student's code. `PATCH /api/projects` validates `board` with Zod.
- `/board` added to the route guards (`proxy.ts`, `lib/auth/guard.ts`), so deactivated or signed-out users are turned away.
- Tests: `board-code.test.ts`, turn test asserts `files` is synced, PATCH board test. Full suite 408 passing; tsc and eslint clean.
- Decision: the old build-mode gate and `pendingCoreTask()` are **not** applied to board turns. The board has no build mode, and the tutor prompt forbids complete solutions before two attempts. The tier escalation is not ported either.
- Open: no browser walkthrough yet; the tasks panel keeps the editor's dark theme against the parchment board; mobile layout of the side panel unchecked; "Show me where" not wired; the task prompt is not sent to the tutor when a task is activated.
- Next: Phase 6 (voice, optional) or Phase 7 (polish); walk the board in a browser first.

## Phase 7: polish (done, not yet walked in a browser)

- Done: smooth scrolling honours `prefers-reduced-motion`; confetti hidden under reduced motion; `:focus-visible` ring on the board; page nav uses `aria-current="page"`; caption no longer double-announced (sr-only status is the one live region); caption/label contrast raised (`/75`-`/80`). Lazy-load audit: CodeEditor already `next/dynamic`; Pyodide worker is created on demand.
- Skipped (Phase 6 skipped by request): voice. Still open: quiz options are not clickable, tasks panel dark theme, mobile side panel, browser walkthrough.

## Browser walkthrough (partial)

- Walked in Chrome: dashboard → Continue → redirected to `/board/[id]`; edited and ran a code node (output + tutor reaction); reload kept code and output; task checks gate `Mark done`; Mark done advanced 1/4 → 2/4 core.
- Bug found and fixed: `codeNodeId` chose the "newest" code node by `Object.keys` order, which Postgres jsonb reorders, so checks ran against the wrong node after a reload. It now follows page order (`board-code.test.ts` regression test).
- Not walked: remaining core tasks, homework unlock and submit, mobile width.
