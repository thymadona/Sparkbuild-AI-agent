import { supabaseAdmin } from './supabase-server'

const HOURLY_LIMIT = 10
const WINDOW_HOURS = 1

export async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; hoursUntilReset: number; count: number }> {
  const windowStart = new Date(
    Date.now() - WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabaseAdmin
    .from('prompts')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })

  if (error) {
    // Fail open — allow the request if we can't check
    console.error('Rate limit check failed:', error)
    return { allowed: true, hoursUntilReset: 0, count: 0 }
  }

  const count = data.length

  if (count < HOURLY_LIMIT) {
    return { allowed: true, hoursUntilReset: 0, count }
  }

  // Compute hours until oldest prompt falls outside the window
  const oldestPromptTime = new Date(data[0].created_at).getTime()
  const resetTime = oldestPromptTime + WINDOW_HOURS * 60 * 60 * 1000
  const hoursUntilReset = Math.ceil((resetTime - Date.now()) / (60 * 60 * 1000))

  return { allowed: false, hoursUntilReset, count }
}
