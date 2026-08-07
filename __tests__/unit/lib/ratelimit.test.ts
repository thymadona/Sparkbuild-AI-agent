import { checkRateLimit } from '@/lib/ratelimit'

const mockLimit = jest.fn()

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    jest.fn().mockImplementation(() => ({
      limit: (...args: unknown[]) => mockLimit(...args),
    })),
    { slidingWindow: jest.fn() }
  ),
}))

jest.mock('@/lib/redis', () => ({ redis: {} }))

const USER_ID = 'user-123'
const HOUR_MS = 60 * 60 * 1000

beforeEach(() => {
  jest.clearAllMocks()
})

describe('checkRateLimit', () => {
  it('allows when under the 50-prompt hourly limit', async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 45, reset: Date.now() + HOUR_MS })

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(5)
    expect(result.hoursUntilReset).toBe(0)
  })

  it('allows when exactly one request remains', async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 1, reset: Date.now() + HOUR_MS })

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(49)
  })

  it('blocks when the limit is reached', async () => {
    mockLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + HOUR_MS })

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(false)
    expect(result.count).toBe(50)
    expect(result.hoursUntilReset).toBeGreaterThanOrEqual(1)
  })

  it('fails open (allows) when Upstash throws', async () => {
    mockLimit.mockRejectedValue(new Error('network error'))

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(0)
    expect(result.hoursUntilReset).toBe(0)
  })

  it('computes hoursUntilReset from the reset timestamp', async () => {
    mockLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 0.5 * HOUR_MS })

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(false)
    expect(result.hoursUntilReset).toBe(1)
  })
})
