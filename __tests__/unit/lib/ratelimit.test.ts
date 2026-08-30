import { randomUUID } from 'crypto'

// jest.setup.ts stubs @/lib/redis for every suite so no test touches a real
// server by accident. This is the one suite that must, so it opts out.
jest.unmock('@/lib/redis')

import { checkRateLimit } from '@/lib/ratelimit'
import { redis } from '@/lib/redis'

// Runs against a real Redis (TEST_REDIS_URL, defaulting to db 15 on localhost),
// for the same reason the database tests use a real Postgres: the limit is
// enforced by a Lua script inside the server, so a mocked client could only
// assert that we called it — never that it counts correctly, expires, or stays
// atomic. The previous version of this file mocked @upstash/ratelimit entirely
// and therefore only tested the arithmetic in the wrapper.
//
// Every test uses a fresh random user id, so tests never collide and nothing
// needs flushing between them — which is also what keeps a misconfigured
// TEST_REDIS_URL from destroying data.
const HOURLY_LIMIT = 50

beforeAll(async () => {
  if (!redis) throw new Error('TEST_REDIS_URL is not usable — is Redis running?')
  try {
    await redis.ping()
  } catch {
    throw new Error(
      'Could not reach Redis for tests. Start one (`brew services start redis`) ' +
        'or point TEST_REDIS_URL at another server.'
    )
  }
})

afterAll(async () => {
  await redis?.quit()
})

describe('checkRateLimit', () => {
  it('allows the first request and counts it', async () => {
    const result = await checkRateLimit(randomUUID())

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(1)
    expect(result.hoursUntilReset).toBe(0)
  })

  it('counts requests cumulatively for the same user', async () => {
    const userId = randomUUID()

    await checkRateLimit(userId)
    await checkRateLimit(userId)
    const third = await checkRateLimit(userId)

    expect(third.allowed).toBe(true)
    expect(third.count).toBe(3)
  })

  it('keeps separate counts per user', async () => {
    const a = randomUUID()
    const b = randomUUID()

    await checkRateLimit(a)
    await checkRateLimit(a)
    const forB = await checkRateLimit(b)

    expect(forB.count).toBe(1)
  })

  it('allows exactly the limit, then blocks', async () => {
    const userId = randomUUID()

    for (let i = 1; i < HOURLY_LIMIT; i++) await checkRateLimit(userId)

    const last = await checkRateLimit(userId)
    expect(last.allowed).toBe(true)
    expect(last.count).toBe(HOURLY_LIMIT)

    const blocked = await checkRateLimit(userId)
    expect(blocked.allowed).toBe(false)
    expect(blocked.count).toBe(HOURLY_LIMIT)
    expect(blocked.hoursUntilReset).toBeGreaterThanOrEqual(1)
  })

  it('stays atomic under concurrent requests from one user', async () => {
    // The reason the check is a Lua script rather than ZCARD-then-ZADD: issued
    // in parallel, separate round-trips would all read the same count and admit
    // every request.
    const userId = randomUUID()

    const results = await Promise.all(
      Array.from({ length: HOURLY_LIMIT + 10 }, () => checkRateLimit(userId))
    )

    expect(results.filter((r) => r.allowed)).toHaveLength(HOURLY_LIMIT)
    expect(results.filter((r) => !r.allowed)).toHaveLength(10)
  })

  it('expires the window so the key does not leak', async () => {
    const userId = randomUUID()
    await checkRateLimit(userId)

    const ttl = await redis!.pttl(`ratelimit:prompts:${userId}`)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000)
  })
})

describe('fail-open behaviour', () => {
  afterEach(() => {
    jest.resetModules()
  })

  it('allows the request when the Redis call throws', async () => {
    jest.resetModules()
    jest.doMock('@/lib/redis', () => ({
      redis: {
        defineCommand: jest.fn(),
        slidingWindow: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      },
    }))
    const { checkRateLimit: isolated } = await import('@/lib/ratelimit')

    const result = await isolated('user-123')

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(0)
    expect(result.hoursUntilReset).toBe(0)
  })

  it('allows the request when no Redis is configured at all', async () => {
    jest.resetModules()
    jest.doMock('@/lib/redis', () => ({ redis: null }))
    const { checkRateLimit: isolated } = await import('@/lib/ratelimit')

    const result = await isolated('user-123')

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(0)
  })
})
