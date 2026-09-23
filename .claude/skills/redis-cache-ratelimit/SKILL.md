---
name: redis-cache-ratelimit
description: The optional Redis layer — `lib/redis.ts` (ioredis over one `REDIS_URL`, `null` when unset, `TEST_REDIS_URL` under test), `lib/cache.ts` `cached()`/`invalidate()` and every cache key with its TTL and invalidation (permissions 30s, enabled lessons 60s, lesson progress 15s), and `lib/ratelimit.ts` `checkRateLimit` (30 tutor turns/minute burst limit, Lua sliding window, fails open, staff bypass). Use for anything mentioning redis, cache, caching, cached(), invalidate, TTL, stale data after a change, rate limit, 429, burst limit, too fast, ioredis, REDIS_URL, Upstash, sliding window, "why is the old value still showing". Use this before exploring `lib/redis.ts`, `lib/cache.ts`, `lib/ratelimit.ts` — it already maps them.
---

# Redis: cache and rate limit (optional)

Redis backs two things and both **fail open**: the app boots, builds and serves with no
`REDIS_URL` — you just get no caching and no rate limiting.

## Files

| Path               | Exports                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| `lib/redis.ts`     | `redis: Redis                                                                       | null`(ioredis). URL =`TEST_REDIS_URL ?? redis://127.0.0.1:6379/15`under`NODE_ENV=test`(so tests can't evict dev entries), else`REDIS_URL`. `null`if unset or not matching`^rediss?://`(logs an error when set but malformed). Singleton on`globalThis.__redis`. |
| `lib/cache.ts`     | `cached<T>(key, ttlSeconds, fn)`; `invalidate(key)`.                                |
| `lib/ratelimit.ts` | `checkRateLimit(userId): Promise<{ allowed, count }>`; `BURST_LIMIT = 30` per 60 s. |

Production URL is `rediss://…` — for Upstash that is the **Redis-protocol/TLS endpoint**, not
the REST URL (`@upstash/redis` and its REST transport are gone).

## `lib/redis.ts` connection options (all three are load-bearing)

- `lazyConnect: true` — never dial during `next build`.
- `maxRetriesPerRequest: 1` — a failing command costs ~200ms, not ioredis's 20 retries.
- `enableOfflineQueue` left at its default (`true`) — setting it `false` with `lazyConnect`
  makes the **first** command of every connection fail.
- Also `connectTimeout: 2000`, `retryStrategy: min(times*100, 1000)`, `on('error')` logs.

## `cached(key, ttl, fn)`

`redis` null → `fn()`. `GET` hit → `JSON.parse`. Miss → `fn()` then `SET key JSON EX ttl`.
Redis read/write errors are logged and swallowed; **errors thrown by `fn` propagate**, so each
caller keeps its own fail-open/closed choice. Values are JSON because ioredis stores strings.

| Key                                             | TTL | Set in                                                          | Invalidated                                                                                               |
| ----------------------------------------------- | --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `perm:<userId>:<key>`                           | 30s | `lib/auth/permissions.ts` `hasPermission`                       | never (TTL only)                                                                                          |
| `role:admin:<userId>` / `role:teacher:<userId>` | 30s | `isAdmin` / `isTeacher`                                         | never                                                                                                     |
| `staff:ctx:<userId>:<keys,joined>`              | 30s | `getStaffContext`                                               | never                                                                                                     |
| `enabled-lessons:<userId>`                      | 60s | `lib/lesson-availability.ts`                                    | never — a teacher enabling a lesson can take up to 60s to show                                            |
| `lesson-progress:<projectId>`                   | 15s | `app/api/projects/[id]/turn/route.ts` (feeds tutor task gating) | `invalidate()` from `app/api/projects/[id]/lesson-progress/route.ts` PUT and `.../complete/route.ts` POST |

Adding a cached read: pick a key prefix, keep the TTL short, and add `invalidate()` at every
write site if the value gates behaviour (the lesson-progress case) — TTL-only is acceptable
only for low-volatility data.

## `checkRateLimit(userId)`

- Key `ratelimit:prompts:<userId>`, sorted set, member `<now>-<uuid>`, window `60_000` ms.
- One Lua script (`slidingWindow`, registered once via `redis.defineCommand`):
  `ZREMRANGEBYSCORE 0 now-window` → `ZCARD` → if `count >= 30` return denied, else `ZADD`, `PEXPIRE window`, return allowed. Atomic — a `ZCARD`-then-`ZADD` pair
  would admit every request in a concurrent burst.
- A burst guard against scripts, not a quota: no student reaches one turn every 2 s for a minute.
  Known ceiling: a script paced just under it gets ~1,800 turns/hour (backstop: staff overview
  prompt counts + deactivation). No reset time is returned — nothing needs it at a 60 s window.
- No Redis or any error → `{ allowed: true, count: 0 }`.
- Sole caller: `app/api/projects/[id]/turn/route.ts` → 429
  `{ error: "Too many messages. Slow down and try again in a moment." }`; `useTutor` captions
  "Whoa, too fast! Wait a moment and try again." (quiet events stay silent). **Admins and teachers bypass** the
  call entirely (`isAdmin || isTeacher`).
- The `prompts` table is a permanent log of every turn (admin views read it); it is
  not read to compute the limit.

## Gotchas

- `lib/redis.ts` comment says it mirrors "the postgres.js singleton" — the DB client is node-postgres.
- `jest.setup.ts` mocks `@/lib/redis` for every suite (`get` → null, `set`/`del` no-ops), so
  tests see "no cache layer" and never touch a server. Only `ratelimit.test.ts` calls
  `jest.unmock('@/lib/redis')` and runs against `TEST_REDIS_URL` (db 15). A new test that
  exercises caching must do the same.

## Tests

- `__tests__/unit/lib/ratelimit.test.ts` — window behaviour, fail open.
- `__tests__/unit/lib/permissions.test.ts` — caching + fail closed.
