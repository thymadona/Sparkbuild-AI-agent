import '@testing-library/jest-dom'

// Default Redis mock so tests never reach a real server. `cached()`
// always misses (falls through to the real DB/RPC call) and writes/deletes are
// no-ops — this reproduces "no caching layer" behavior for every existing test
// without each one needing its own mock. Tests that specifically exercise
// caching/rate-limit behavior (ratelimit.test.ts) call jest.unmock('@/lib/redis')
// and run against the real TEST_REDIS_URL server.
jest.mock('@/lib/redis', () => ({
  redis: {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
  },
}))

// better-auth ships ESM only, and Jest loads it in a CommonJS context where
// its .mjs files fail to parse. Component tests reach lib/auth/client.ts
// transitively (navbar -> ProfileDropdown), and none of them exercise a real
// sign-in, so the browser client is stubbed for every suite. Tests that care
// about auth behaviour drive the server side instead, through
// lib/auth/session.ts, which is plain TypeScript.
jest.mock('@/lib/auth/client', () => ({
  authClient: {
    signIn: { social: jest.fn() },
    signOut: jest.fn(),
    useSession: () => ({ data: null, isPending: false }),
  },
  signIn: { social: jest.fn() },
  signOut: jest.fn(),
  useSession: () => ({ data: null, isPending: false }),
}))
