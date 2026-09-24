# Delete dead code: requirements

Roadmap phase 4. The web course, the HTML editor and the Phase-1 board demo are gone, but a few
files and a lot of comments still describe them. Every new session reads those and gets misled.
This phase removes the leftovers so the code and the docs describe only the Python board.

## Scope

- **Delete files with no live caller:**
  - `components/SparkyWorld.tsx` (the world canvas) and `components/PythonRunner.tsx` (the old
    editor's runner, the only caller of SparkyWorld).
  - The `/board` scripted demo: `app/board/page.tsx`, `app/board/BoardClient.tsx`,
    `app/board/fixture.ts`. `/board/[id]` stays.
  - `PROGRESS.md` at the repo root, a stale build log of the board.
  - `lib/lesson-project.ts`. It has no caller, because the lesson-progress route keeps its own copy
    of `getLessonProject`.
- **Trim the hook.** `usePythonRunner` loses its `world` state (events + run id), which only
  PythonRunner read.
- **Dead config.** Delete the `/templates/:path*.html` cache header block in `next.config.js`, and
  fix the COEP comment that points at PythonRunner's inputs box.
- **Stale comments.** Reword comments that cite `/api/generate`, "build mode" or the "Mark done"
  button so they describe what the code does today. The open core task is the one Sparky works on,
  and the only one `task_complete` may finish. There is no build mode. Delete a comment only if
  nothing true remains to say.
- **Docs sync.** `CLAUDE.md` Known issues, and the `ai-tutor`, `project-architecture`,
  `lesson-authoring` and `lesson-progress` skills, stop naming the deleted files, `PROGRESS.md`,
  `/api/generate` and build mode.

## Non-goals

- **The `/editor/:path*` COEP block stays.** Moving isolation to `/board` is phase 6.
- **No prompt change.** `PAGE_RULE`'s "different screen" line stays, so no tutor-eval run.
- **The world API stays.** `sparky` in `public/py-runtime.py`, `lib/sparky-events.ts`, the worker's
  `events`, and `worldContains` checks are live (week 1 `color:` and week 2 `door:` checks).
- **Shipped migrations are never edited**, even though `drizzle/0009` and `drizzle/_archive/`
  comments mention `/api/generate` and build mode.
- **No unused-export sweep** beyond the named items.
- **No board schema changes.** The unrendered `preview` node and the `flow`/`loop_counter`/
  `call_stack` diagram kinds stay, because removing a node type touches saved boards.
- The `app_settings` type is phase 8.

## Decisions and why

- **Named list plus stale comments and dead config, plus `lib/lesson-project.ts`.** It is a dead
  file of the same kind, found while writing this spec. The comments are what mislead sessions most.
  A wider sweep would grow the diff past one review.
- **Delete `PROGRESS.md`.** `specs/` is now the project memory. Git history keeps the log.
- **Bare `/board` returns a plain 404.** Nothing links to it, and the `startsWith('/board')` guards
  in `proxy.ts` and `lib/auth/guard.ts` still cover `/board/[id]`, so they stay as they are.
- **Leave `/editor` COEP to phase 6.** Retargeting it changes runtime behaviour and needs its own
  `input()` browser check.
- **Leave `PAGE_RULE` alone.** Old projects may still hold pre-board chat, so the line is arguably
  still true, and keeping it means the phase is prompt-free.
- **Drop the hook's `world` state.** World checks get their events through `useRuntimeChecks` →
  `runPythonChecks`, not through this state. Add it back when a board node draws the world.

## Constraints

- No migration, no env change, no shipped task id or anchor touched.
- `BoardView` is live (`LiveBoard` and `BoltSwitch.test.tsx` use it). Only `BoardClient` goes.
