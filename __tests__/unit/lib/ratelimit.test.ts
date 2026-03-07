import { checkRateLimit } from '@/lib/ratelimit'

// Mock supabaseAdmin used inside ratelimit.ts
const mockFrom = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args) => mockFrom(...args) },
}))

const USER_ID = 'user-123'

function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  }
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('checkRateLimit', () => {
  it('allows when prompt count is below the 20-prompt daily limit', async () => {
    mockFrom.mockReturnValue(makeChain({ data: Array(10).fill({ created_at: new Date().toISOString() }), error: null }))

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(10)
    expect(result.hoursUntilReset).toBe(0)
  })

  it('allows when prompt count is exactly 19', async () => {
    mockFrom.mockReturnValue(makeChain({ data: Array(19).fill({ created_at: new Date().toISOString() }), error: null }))

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(19)
  })

  it('blocks when prompt count reaches 20', async () => {
    const oldestTime = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
    const prompts = [
      { created_at: oldestTime },
      ...Array(19).fill({ created_at: new Date().toISOString() }),
    ]
    mockFrom.mockReturnValue(makeChain({ data: prompts, error: null }))

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(false)
    expect(result.count).toBe(20)
    expect(result.hoursUntilReset).toBeGreaterThanOrEqual(1)
  })

  it('blocks when prompt count exceeds 20', async () => {
    const oldestTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    const prompts = Array(25).fill({ created_at: oldestTime })
    mockFrom.mockReturnValue(makeChain({ data: prompts, error: null }))

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(false)
    expect(result.count).toBe(25)
  })

  it('fails open (allows) when supabase returns an error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB unavailable' } }))

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(true)
    expect(result.count).toBe(0)
    expect(result.hoursUntilReset).toBe(0)
  })

  it('computes hoursUntilReset from the oldest prompt in the window', async () => {
    // Oldest prompt was 22 hours ago → resets in ~2 hours
    const oldestTime = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString()
    const prompts = Array(20).fill({ created_at: oldestTime })
    mockFrom.mockReturnValue(makeChain({ data: prompts, error: null }))

    const result = await checkRateLimit(USER_ID)

    expect(result.allowed).toBe(false)
    expect(result.hoursUntilReset).toBe(2)
  })
})
