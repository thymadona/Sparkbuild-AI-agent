import '@testing-library/jest-dom'

// Default Redis mock so tests never make real Upstash network calls. `cached()`
// always misses (falls through to the real DB/RPC call) and writes/deletes are
// no-ops — this reproduces "no caching layer" behavior for every existing test
// without each one needing its own mock. Tests that specifically exercise
// caching/rate-limit behavior (e.g. ratelimit.test.ts) override this locally.
jest.mock('@/lib/redis', () => ({
  redis: {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
  },
}))
