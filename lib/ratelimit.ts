import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

const HOURLY_LIMIT = 50

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(HOURLY_LIMIT, '1 h'),
  analytics: true,
  prefix: 'ratelimit:prompts',
})

export async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; hoursUntilReset: number; count: number }> {
  try {
    const { success, remaining, reset } = await ratelimit.limit(userId)

    if (success) {
      return { allowed: true, hoursUntilReset: 0, count: HOURLY_LIMIT - remaining }
    }

    const hoursUntilReset = Math.ceil((reset - Date.now()) / (60 * 60 * 1000))
    return { allowed: false, hoursUntilReset, count: HOURLY_LIMIT - remaining }
  } catch (err) {
    // Fail open — allow the request if we can't check
    console.error('Rate limit check failed:', err)
    return { allowed: true, hoursUntilReset: 0, count: 0 }
  }
}
