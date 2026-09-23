# Tutor burst limit: plan

One group, small enough for a single review. Read `requirements.md` first. Skill:
`redis-cache-ratelimit`. Use `ai-tutor` only for the turn route and `useTutor`.

## 1. Retune the limiter and ship

- `lib/ratelimit.ts`: 30 turns per 60-second window. Rename the "hourly" constants. The reset value
  it returns becomes honest (seconds), or is dropped if nothing reads it. Update the comments that
  say "hour".
- `app/api/projects/[id]/turn/route.ts`: the 429 body says to slow down, with no hours in it.
  The staff bypass stays.
- `app/board/useTutor.ts`: the 429 caption becomes a soft "slow down" line (e.g. "Whoa, too fast!
  Wait a moment and try again."). Quiet events stay silent.
- Tests:
  - `__tests__/unit/lib/ratelimit.test.ts`: the limit constant goes from 50 to 30. The key's TTL is
    at most 60 s. The concurrent burst (limit + 10) admits exactly the limit. The fail-open tests
    are unchanged.
  - `__tests__/integration/api/turn.test.ts` and `task-complete.test.ts`: match the mocked return
    shape to the new one. Keep the 429 case, and add or keep a check that staff are not limited.
- Docs:
  - `.claude/skills/redis-cache-ratelimit/SKILL.md`: the description and body say "50 tutor
    turns/hour".
  - `.claude/skills/ai-tutor/SKILL.md`: the turn-route line about the 429.
  - The `CLAUDE.md` skills-index row, only if its wording changes.
- Work through `validation.md`. Open the PR, reword roadmap phase 2 to "Replace the hourly cap with
  a burst limit" and tick it. The PR notes no migration and no env change.
