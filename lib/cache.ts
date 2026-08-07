import { redis } from './redis'

// A cache read/write failure is never a correctness signal — it just means we
// skip the cache and fall through to `fn`, which carries its own error
// handling (fail-open or fail-closed, whichever the caller needs).
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get<T>(key)
    if (hit !== null && hit !== undefined) return hit
  } catch (err) {
    console.error(`cache read failed for ${key}:`, err)
  }

  const value = await fn()

  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.error(`cache write failed for ${key}:`, err)
  }

  return value
}

export async function invalidate(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (err) {
    console.error(`cache invalidation failed for ${key}:`, err)
  }
}
