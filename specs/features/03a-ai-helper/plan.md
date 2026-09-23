# AI helper (Bolt): plan

Four groups, in order. Read `requirements.md` first. Skills: `ai-tutor` (every group),
`database` (group 1), `lesson-progress` (group 3, evidence and `task_complete`),
`redis-cache-ratelimit` (group 2). Group 1 touches the database, and groups 2–3 touch progress
evidence, so review each group before starting the next.

## 1. Data and the board block

- Migration `0011`: widen `messages_role_check` to include `'helper'` (`lib/db/schemas/messages.ts`
  → `bun run db:generate` → `bun run db:migrate`). Add `'helper'` to the `messages` role union in
  `types/index.ts`.
- `lib/board/schema.ts`: a new node type for Bolt's block. It holds the student's request and
  Bolt's Python source (≤ 8 non-blank lines). `SavedBoard` accepts it. It is not a `code` node, so
  `pageCode`, `boardCode` and `taskPrograms` never read it.
- `lib/board/reducer.ts`: a third actor for Bolt. Only Bolt may add the new type, and Bolt may add
  nothing else. Sparky (`'tutor'`) may not create, patch or remove it. The client may not change
  its source.
- `app/board/Nodes.tsx` (+ its own component beside it): render the block, marked as written by
  Bolt, with "You asked: …", read-only code and a Run button. Running it shows output under the
  block and sends no event to Sparky.
- Fix the `aiPolicy` comment in `lib/lessons.ts`.
- Tests: reducer actor rules; `SavedBoard` round-trips the node; the component renders read-only
  and runs (jsdom).

## 2. Bolt's route

- `lib/helper/prompt.ts`: `BOLT_PROMPT`. Bolt builds exactly what was asked, at most 8 lines of
  Python, adds nothing the student did not describe, and writes one short plain-text caption.
- `app/api/projects/[id]/helper/route.ts` (`POST`, `runtime = 'nodejs'`):
  1. `getSessionUser()` → 401; `isUuid(id)` → 404; staff bypass or `checkRateLimit` → 429.
  2. zod body `{ request, pageId }` → 400.
  3. Owner-scoped project select → 404. `getLessonForProject`; no lesson or `aiPolicy` other
     than `'director'` → 403.
  4. The model sees `BOLT_PROMPT`, the request and the student's code on `pageId` only. One forced
     tool writes the code and caption.
  5. Run it through `runTurn` (`lib/tutor/turn.ts`) with a Bolt model call and a collecting
     `emit`, so its retry loop is reused. More than 8 non-blank lines → an error back to the
     model, the same as a bad board op, up to 2 retries. Still too long → no block, and a "too
     big, ask for a smaller piece" caption.
  6. Apply the add op as Bolt. Persist `projects.board` (owner-scoped). Insert one `messages` row,
     `role: 'helper'`, holding the request and Bolt's code. Log to `prompts` with
     `context.tutor = 'bolt'` (errors swallowed).
  7. Return JSON, not SSE: the op (or none) and Bolt's caption.
- Tests (`__tests__/integration/api/helper.test.ts`, real DB, mocked DeepSeek, a fixture director
  lesson that lives only in `__tests__`): 401/404/429/400; 403 on a tutor lesson and on a project
  with no lesson; happy path persists the node and the `'helper'` row; the model never sees the
  task goal or chat history; the over-8-lines retry and the give-up caption; staff bypass.

## 3. Sparky's side

- `lib/tutor/events.ts`: a `helper_result {nodeId}` client event. It renders the request and
  Bolt's code for Sparky to react to.
- `app/api/projects/[id]/turn/route.ts`:
  - History: `'helper'` rows reach the model marked as Bolt exchanges, not as student speech. They
    are excluded from `stuckTurns` and `prevUserMessage`.
  - The director-lesson layer (in `lessonLayer` or a sibling, never `TUTOR_PROMPT`) says Bolt
    exists. On `helper_result`, Sparky asks one question and writes no code.
  - `hasRun` / `taskPrograms` ignore Bolt's block and its output, so `task_complete` still needs
    a run of the student's own editor.
- `scripts/tutor-eval.ts`: cases for Bolt (a vague request is built literally, ≤ 8 lines, nothing
  beyond the request) and for Sparky on `helper_result` (a question, no code). Existing cases must
  still pass.
- Tests: `turn.test.ts`: for a tutor lesson, the system prompt has no Bolt text and `toolsFor` is
  unchanged; for a director lesson, helper rows are marked and not counted as stuck turns.
  `task-complete.test.ts`: a run of Bolt's block alone is refused as evidence. `tutor-turn` /
  `events` unit tests for `helper_result`.

## 4. The switch, docs and ship

- `app/board/BoardView.tsx` / `LiveBoard.tsx`: in director lessons only, a Sparky / Bolt switch on
  the chat input (default Sparky). Bolt mode posts to the helper route with a plain fetch, not
  through `useTutor`'s queue. It shows "Bolt is building…",
  dispatches the returned op as Bolt, shows Bolt's caption, then sends `helper_result` through
  `useTutor`. A 429 shows the existing slow-down caption. It must fit at 375 px.
- jsdom tests: no switch in a tutor lesson; the switch routes to Bolt in a director lesson; the
  block appears and `helper_result` is sent after it.
- Docs: `CLAUDE.md` (the Bolt hard-rule line, latest migration `0011`); `ai-tutor` skill (Bolt
  route, node, actor, `helper_result`, the rewritten director-mode invariant); `database` skill
  (`messages` roles); `lesson-progress` skill (Bolt's block is never evidence).
- Work through `validation.md`. Open the PR, which notes migration `0011`, no env change, and the
  3b carry-forward. Tick roadmap 3a.
