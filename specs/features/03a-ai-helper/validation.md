# AI helper (Bolt): validation

## Tests to add or change

- `__tests__/unit/lib/board-reducer.test.ts`:
  - Only Bolt may add its block, and Bolt may add nothing else.
  - Sparky cannot create, patch or remove Bolt's block.
  - The client cannot change its source.
- `SavedBoard` round-trips a board with Bolt's block, and a block over 8 lines is rejected.
- `__tests__/integration/api/helper.test.ts` (new; real DB, mocked DeepSeek, fixture director
  lesson in `__tests__` only):
  - 401 with no session, 404 for a bad or foreign id, 400 for a bad body, 429 when limited.
  - Staff are never limited.
  - 403 for a tutor lesson (weeks 1–7) and for a project with no lesson.
  - Happy path: the block lands on the right page, `projects.board` is saved, and one
    `messages` row with `role = 'helper'` is written. `prompts.context.tutor = 'bolt'`.
  - The model's input holds the request and the page's code, but not the task goal, the checks or
    the chat history.
  - Over 8 lines: the model is told and retries. Still over after 2 retries: no block, and the
    "ask for a smaller piece" caption.
- `__tests__/integration/api/turn.test.ts`:
  - Tutor lesson: the system prompt has no Bolt text, and the tools are the same as before.
  - Director lesson: `'helper'` rows reach the model marked as Bolt exchanges, and they do not
    raise `stuckTurns` or the escalation tier.
  - `helper_result` reaches the model with the request and Bolt's code.
- `__tests__/integration/api/task-complete.test.ts`: running only Bolt's block is not evidence, so
  `task_complete` is refused. Running the student's editor still works.
- `__tests__/unit/lib/tutor-events` (or the existing events test): `helper_result` parses, and
  rejects an unknown node id.
- jsdom (`__tests__/unit/components/`):
  - Bolt's block renders read-only with the request and a Run button.
  - No Sparky / Bolt switch in a tutor lesson.
  - In a director lesson, Bolt mode posts to the helper route, shows the block, then sends
    `helper_result`.

## Commands (all must pass)

```bash
bun run db:migrate:test
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/integration/api/helper.test.ts __tests__/integration/api/turn.test.ts __tests__/integration/api/task-complete.test.ts
bun run test
bun run lint            # only the known no-page-custom-font warning
bun run format:check
bun --env-file=.env run scripts/tutor-eval.ts   # by hand, not in CI: new Bolt cases and every old case pass
```

## Browser check: deferred to 3b

No shipped lesson is a director lesson until 3b, so a student cannot reach Bolt in 3a. The
phone (375), tablet (768) and laptop check of the switch and Bolt's block is part of 3b's
validation. 3a's UI proof is the jsdom tests above. 3b's hand test also times Bolt's reply: if
the "Bolt is building…" wait feels too long, move Bolt to a stream (see requirements).

## By hand (owner)

1. Open any week 1–7 board as a student. There is no switch, and Sparky behaves exactly as before.
2. Call `POST /api/projects/<id>/helper` on a week 1–7 project with a student's session cookie.
   It returns 403.
3. Read the tutor-eval output for the Bolt cases. "make a game" gets a literal, tiny program, not
   a guessed game. No answer is over 8 lines.
4. After the migration, `\d messages` in `db:studio` or `psql` shows `'helper'` in the role check.
