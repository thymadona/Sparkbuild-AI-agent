import { randomUUID } from 'crypto'
import type Redis from 'ioredis'
import { redis } from './redis'

// A burst limit, not a quota: no student working through a lesson sends a turn every two
// seconds for a whole minute, but a script calling the tutor in a loop trips it within seconds.
// ponytail: a script paced just under this gets ~1,800 turns/hour; add a daily cap if that happens.
const BURST_LIMIT = 30
const WINDOW_MS = 60 * 1000

// Replaces @upstash/ratelimit, which only accepted an @upstash/redis client and
// so could not survive the move to a plain REDIS_URL. This is a true sliding
// window over a sorted set — one member per request, scored by timestamp —
// rather than Upstash's two-window approximation, so a burst can no longer be
// spread across a window boundary to exceed the limit.
//
// It runs as one Lua script because the read-then-write must be atomic: with
// separate ZCARD and ZADD round-trips, concurrent requests from the same student
// all read the same count and every one of them is admitted.
const SLIDING_WINDOW_LUA = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count >= limit then
  return { 0, count }
end

redis.call('ZADD', key, now, member)
-- Refreshed on every admitted request, so the key outlives the newest entry and
-- Redis reclaims it once a student stops prompting.
redis.call('PEXPIRE', key, window)
return { 1, count + 1 }
`

type LimiterClient = Redis & {
  slidingWindow(
    key: string,
    now: string,
    windowMs: string,
    limit: string,
    member: string
  ): Promise<[number, number]>
}

let client: LimiterClient | null = null

// defineCommand registers the script once and uses EVALSHA with an automatic
// fallback when the server has not cached it (a restarted or failed-over Redis),
// rather than shipping the whole script on every request.
function limiter(): LimiterClient | null {
  if (!redis) return null
  if (!client) {
    redis.defineCommand('slidingWindow', { numberOfKeys: 1, lua: SLIDING_WINDOW_LUA })
    client = redis as LimiterClient
  }
  return client
}

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; count: number }> {
  const redisClient = limiter()

  // No Redis configured is the same as Redis being unreachable: allow.
  if (!redisClient) return { allowed: true, count: 0 }

  try {
    const now = Date.now()
    const [allowed, count] = await redisClient.slidingWindow(
      `ratelimit:prompts:${userId}`,
      String(now),
      String(WINDOW_MS),
      String(BURST_LIMIT),
      // Two requests in the same millisecond would otherwise collide on score
      // *and* member, and ZADD would update one entry instead of adding a second.
      `${now}-${randomUUID()}`
    )

    return { allowed: allowed === 1, count }
  } catch (err) {
    // Fail open — allow the request if we can't check
    console.error('Rate limit check failed:', err)
    return { allowed: true, count: 0 }
  }
}
