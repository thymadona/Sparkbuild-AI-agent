# Tutor burst limit: validation

## Tests to change

- `__tests__/unit/lib/ratelimit.test.ts`:
  - 30 turns in a window are allowed, and the 31st is blocked.
  - Each student has their own window.
  - A concurrent burst of 40 admits exactly 30.
  - The key expires within 60 s.
  - No Redis, or a Redis error, allows the turn (fail open).
- `__tests__/integration/api/turn.test.ts`:
  - A limited student gets a 429 whose error does not mention hours.
  - Staff are never limited.
- `__tests__/integration/api/task-complete.test.ts` still passes with the new mock shape.

## Commands (all must pass)

```bash
NODE_OPTIONS=--experimental-vm-modules bunx jest __tests__/unit/lib/ratelimit.test.ts __tests__/integration/api/turn.test.ts __tests__/integration/api/task-complete.test.ts
bun run test
bun run lint            # only the known no-page-custom-font warning
bun run format:check
```

`scripts/tutor-eval.ts` does not need to run, because the prompt does not change.

## Browser check (phone 375, tablet 768, laptop)

- Force a 429 on a board, either with a loop or by lowering the limit locally. The slow-down
  caption fits in Sparky's bubble with no horizontal scroll at every width.
- After waiting a minute, the next message gets a normal reply.

## By hand (owner)

1. As a student, work through a lesson for 50 or more turns: chat, runs and quiz answers. You are
   never blocked.
2. On a throwaway project, send 31 turns **at the same time**, for example with parallel curl
   calls that use a student's session cookie. Each turn streams from DeepSeek for several seconds,
   so a loop that sends them one by one may never reach 31 in a minute. At least one turn returns 429.
3. In the same minute, send one message from that student's board. Sparky shows the slow-down
   caption.
4. Repeat step 2 as a teacher or admin. There is no 429.
