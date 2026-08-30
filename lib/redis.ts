import Redis from 'ioredis'

// One `REDIS_URL` connection string for every environment: `redis://` against a
// local server in development and CI, `rediss://` against a hosted one in
// production (Upstash exposes a TLS Redis-protocol endpoint alongside its REST
// API). This replaced `@upstash/redis`, whose REST transport could only ever
// talk to Upstash.
//
// The variable is deliberately OPTIONAL. Both callers — lib/cache.ts and
// lib/ratelimit.ts — fail open, so the app has to boot, build and serve without
// Redis configured. `Redis.fromEnv()` used to throw during module evaluation,
// which is what made `next build` fail at page-data collection on any route that
// transitively imported this file.
//
// Under Jest the URL comes from TEST_REDIS_URL instead, mirroring
// lib/db/client.ts's TEST_DATABASE_URL split so a test run can never evict or
// overwrite development cache entries. It defaults to database 15 on a local
// server — the conventional scratch database — so `bun run test` works against
// a stock `brew services start redis` with nothing to configure.
const isTest = process.env.NODE_ENV === 'test'
const url = isTest
  ? (process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/15')
  : process.env.REDIS_URL

// A malformed value is treated as "not configured" rather than allowed to throw
// out of the constructor — same reasoning as above, and it keeps a fat-fingered
// .env from taking the whole app down.
const isUsable = typeof url === 'string' && /^rediss?:\/\//.test(url)

if (url && !isUsable) {
  console.error(`REDIS_URL is set but is not a redis:// or rediss:// URL — continuing without Redis`)
}

function createClient(): Redis {
  const client = new Redis(url as string, {
    // Do not dial at import time: this module is evaluated during `next build`
    // and in every cold serverless invocation that never touches the cache.
    lazyConnect: true,
    // Bounds how long a command waits when Redis is unreachable — measured at
    // 160-450ms to reject, versus ioredis's default of 20 retries. This is what
    // makes "fail open" mean "fall through quickly", not "hang the student's
    // request until the connection returns".
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    // Caps the reconnect backoff (ioredis's default climbs to 2s). It must never
    // return null: that would stop reconnecting permanently, so a single Redis
    // restart would leave the app cacheless and unlimited until redeployed.
    retryStrategy: (times: number) => Math.min(times * 100, 1000),
    // `enableOfflineQueue` is deliberately left at its default of true. Setting
    // it to false alongside lazyConnect makes the *first* command of every
    // connection fail with "Stream isn't writeable" — the connection is still
    // being established and there is nowhere to queue it — which would silently
    // fail open on the first request of every cold start.
  })

  // ioredis emits connection failures as an 'error' event. Node treats an
  // 'error' event with no listener as fatal and kills the process, so this
  // listener is what keeps an unreachable Redis from taking the app down. The
  // command itself still rejects, and both callers catch and fall through.
  client.on('error', (err: Error) => {
    console.error('Redis connection error:', err.message)
  })

  return client
}

// Reused across HMR reloads in development and across warm invocations in
// production, so we hold one connection pool rather than one per reload —
// mirrors the postgres.js singleton in lib/db/client.ts.
const globalForRedis = globalThis as unknown as { __redis?: Redis | null }

export const redis: Redis | null =
  globalForRedis.__redis ?? (globalForRedis.__redis = isUsable ? createClient() : null)
