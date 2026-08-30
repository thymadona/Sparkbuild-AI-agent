import { redis } from './redis'

// A cache read/write failure is never a correctness signal — it just means we
// skip the cache and fall through to `fn`, which carries its own error
// handling (fail-open or fail-closed, whichever the caller needs). An unset
// REDIS_URL is the same situation, so `redis` being null takes the same path
// rather than being an error.
//
// Values are stored as JSON. `@upstash/redis` serialised transparently over its
// REST transport; ioredis speaks the Redis protocol, where every value is a
// string, so the encoding is explicit here.
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  if (!redis) return fn()

  try {
    const hit = await redis.get(key)
    if (hit !== null && hit !== undefined) return JSON.parse(hit) as T
  } catch (err) {
    console.error(`cache read failed for ${key}:`, err)
  }

  const value = await fn()

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (err) {
    console.error(`cache write failed for ${key}:`, err)
  }

  return value
}

export async function invalidate(key: string): Promise<void> {
  if (!redis) return

  try {
    await redis.del(key)
  } catch (err) {
    console.error(`cache invalidation failed for ${key}:`, err)
  }
}
