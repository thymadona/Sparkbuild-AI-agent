# AI helper (Bolt): requirements

Roadmap phase 3a. This adds **Bolt**, a separate AI helper that writes a small, read-only piece of
code from the student's request. Phase 3b (Week 8 — Ask AI Well) is the first lesson that uses it.
**Nothing in 3a reaches students:** no shipped lesson has `aiPolicy: 'director'` until 3b.

## Scope

- **Bolt, a second AI character.** Bolt has its own prompt and its own route. It uses the same
  DeepSeek model (`deepseek-v4-flash`). Sparky stays a tutor who never writes the answer.
- **On only in director lessons.** Bolt answers only when the project's lesson has
  `aiPolicy: 'director'`. Weeks 1–7 (`'tutor'`) do not change at all.
- **A Sparky / Bolt switch on the chat box.** It appears only in director lessons and starts on
  Sparky. With Bolt selected, what the student sends is a request to Bolt, not a message to Sparky.
- **Bolt writes a "Bolt wrote this" block** on the current task page. The block shows the
  student's request and Bolt's code. It is read-only, clearly marked as AI-written, and the
  student can run it. The student moves code into their own editor by copying it by hand.
- **Sparky reflects once.** After Bolt answers, the board sends Sparky a `helper_result` event.
  Sparky gets one turn to ask a question about it, such as whether it does what the student
  asked. Sparky never writes or fixes the code.
- **Storage.** Each Bolt exchange is saved in `messages` with a new role, `'helper'`, so Sparky's
  history and teachers can see it.
- **Prompt tests.** `scripts/tutor-eval.ts` gets Bolt and `helper_result` cases.

## Non-goals

- No Week 8 content, no lesson with `aiPolicy: 'director'`, no Bolt persona art. That is 3b.
- No Insert button: Bolt's code reaches the editor only by hand.
- No plan-first gate (mission rule 1). That is Week 10, roadmap phase 7.
- No "explain before accepting" step (mission rule 4). 3b owns it (see Constraints).
- No new model or provider, no per-user toggle, no streaming for Bolt.
- No change to how Sparky judges or completes tasks in tutor lessons.

## Decisions and why

- **A separate helper, not Sparky in "director mode".** The mission says "a separate AI helper
  may write code". Keeping Bolt out of Sparky's tools keeps "Sparky never writes the answer" true
  in every week. This replaces the `ai-tutor` skill invariant that director mode "belongs in this
  route + `toolsFor`". The skill and the stale `aiPolicy` comment in `lib/lessons.ts` ("build
  mode stays locked… checked by outcome") are rewritten to match.
- **Bolt builds exactly what was asked.** It builds a vague request ("make a game") literally,
  even when the result is useless, and adds nothing the student did not describe. Week 8 is about
  seeing why a clear request matters, so Bolt must not quietly fill gaps.
- **Bolt sees only the request and the student's current code** on that task page. It does not
  see the task goal, the checks or the chat history. It cannot "know" the answer the task wants.
- **Bolt's code goes in its own read-only block, never the student's editor.** AI code and student
  code stay apart, which rules 3 (the student finds the bug) and 4 (the student explains) depend
  on. It also keeps Sparky's evidence honest (below).
- **Three guard rails, enforced on the server, not only in the prompt:**
  1. **Director lessons only.** The Bolt route refuses (403) when there is no lesson or its
     `aiPolicy` is not `'director'`.
  2. **Bolt never completes a task.** Bolt has no `task_complete` tool. Its block is never evidence
     for Sparky's `task_complete`: running it does not count as `hasRun`, and it is not one of the
     task's programs. Only the student's editor counts, as today.
  3. **At most 8 lines** (mission rule 2). Non-blank lines count. If Bolt returns more, the route
     tells it and it retries up to twice, the same way as a bad board op. If the answer is still
     too long, no block is added and Bolt says (in a short caption) that the request is too big
     and asks for a smaller piece. That is itself a Week 8 lesson.
- **Bolt answers in one JSON response, not SSE.** The 8-line cap can only be checked on Bolt's
  whole answer (after any retries), so the code must arrive in one piece anyway. A stream would
  only make the one-line caption appear word by word. A plain fetch also stays out of the single
  queue that `useTutor` uses for Sparky's events. The route still reuses `runTurn`'s retry loop
  and returns what it collects, so moving to a stream later changes only how the reply is sent.
  The board shows "Bolt is building…" until the reply arrives. **Revisit in 3b:** if the wait
  (about 3–6 s, more with retries) feels too long in the hand test, switch to a stream.
- **Running Bolt's block stays on the board.** It runs in Pyodide like any program, but it does not
  send a `code_run_result` to Sparky and uses no tutor turn.
- **`'helper'` rows in Sparky's history.** Sparky sees them marked as Bolt exchanges (what was
  asked, what Bolt wrote), not as things the student said to Sparky. They do not count toward
  `stuckTurns` or confusion detection, so talking to Bolt never raises Sparky's hint tier.
- **Bolt is mentioned only in director lessons.** The note about Bolt and the `helper_result`
  rule go in the lesson layer for director lessons, never in `TUTOR_PROMPT`, so the system prompt
  for weeks 1–7 does not change.
- **Rate limit.** A Bolt request uses the same 30 turns/minute bucket as Sparky, with the same
  staff bypass. A Bolt request plus Sparky's reflection costs 2 turns.
- **Proven by tests in 3a, checked by hand in 3b.** No director lesson ships in 3a, so the
  integration and jsdom tests use a fixture director lesson that exists only in `__tests__`. The
  browser check at phone, tablet and laptop widths moves to 3b. The "every device" policy is
  carried forward, not dropped.

## Constraints

- **Migration `0011`** widens `messages_role_check` to `'user', 'assistant', 'teacher', 'helper'`.
  Update the `messages` role union in `types/index.ts` by hand. Update `CLAUDE.md` (latest
  migration) and the `database` skill.
- **No new environment variables.**
- **The Bolt route follows the hard rules:** `getSessionUser()` → 401, `isUuid(id)` → 404, an
  owner-scoped project select, the rate limit, a zod-validated body, `runtime = 'nodejs'`. Every
  Bolt call is logged to `prompts` with its own `context.tutor` value (`'bolt'`).
- **The board schema** gets one new node type for Bolt's block. `SavedBoard` accepts it. Sparky
  may not create, change or remove it, and the student may not edit its code.
- **Tutor eval.** Sparky's prompt changes (director lessons only), so run
  `bun --env-file=.env run scripts/tutor-eval.ts` by hand. All existing cases must still pass.
- **`CLAUDE.md`** gets one hard-rule line about Bolt: director lessons only, ≤ 8 lines, its own
  block, never evidence, never completes a task.
- **Carry-forward to 3b (hard): mission rule 4.** A student can paste Bolt's code into their
  editor, and Sparky could then complete the task on AI code the student never explained. No
  director lesson may ship until 3b decides how pasted Bolt code is judged (for example, an
  explain step before `task_complete`).
- **Every device.** The switch and Bolt's block must fit at 375 px. They are proven in jsdom in
  3a and checked in the browser in 3b.
