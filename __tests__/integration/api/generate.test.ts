/**
 * Integration tests for /api/generate route handler.
 * DeepSeek client and Supabase are fully mocked.
 */

const mockGetSessionUser = jest.fn()
const mockAdminFrom = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockCreate = jest.fn()
const mockIsAdmin = jest.fn()
const mockIsTeacher = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  getSessionUser: () => mockGetSessionUser(),
}))

jest.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
  },
}))

jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

jest.mock('@/lib/auth/permissions', () => ({
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
  isTeacher: (...args: unknown[]) => mockIsTeacher(...args),
}))

jest.mock('@/lib/gemini', () => ({
  deepseek: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  },
  MODEL: 'deepseek-v4-flash',
  ASK_SYSTEM_PROMPT: 'You are a coding tutor.',
  BUILD_SYSTEM_PROMPT: 'You are a code generator.',
}))

jest.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: jest.fn() }),
}))

import { POST } from '@/app/api/generate/route'

const AUTHED_USER = { id: 'user-abc' }
const VALID_PROJECT = { id: 'proj-1', user_id: AUTHED_USER.id }

function makeRequest(body: object) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeAdminChain(singleResult: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(singleResult),
  }
  Object.values(chain).forEach((fn) => {
    if (fn !== chain.insert && fn !== chain.single) {
      fn.mockReturnValue(chain)
    }
  })
  return chain
}

/** Creates an async iterable that yields SSE-style chunks. */
function makeStreamChunks(texts: string[]) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < texts.length) {
            return { value: { choices: [{ delta: { content: texts[i++] } }] }, done: false }
          }
          return { value: undefined, done: true }
        },
      }
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockIsAdmin.mockResolvedValue(false)
  mockIsTeacher.mockResolvedValue(false)
})

describe('POST /api/generate', () => {
  // ---- Auth checks ----------------------------------------------------------

  it('returns 401 when user is not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null)

    const res = await POST(makeRequest({ prompt: 'build a todo app', projectId: 'p1' }))
    expect(res.status).toBe(401)
  })

  // ---- Rate limit checks ----------------------------------------------------

  it('returns 429 when the user has exceeded the hourly limit', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 3, count: 10 })

    const res = await POST(makeRequest({ prompt: 'build something', projectId: 'p1' }))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toMatch(/hourly limit/i)
    expect(json.error).toMatch(/3 hour/)
  })

  it('bypasses the rate limit for admins even when over the hourly limit', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockIsAdmin.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 3, count: 20 })

    const chain = makeAdminChain({ data: VALID_PROJECT, error: null })
    const updateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
    chain.update.mockReturnValue(updateChain)
    mockAdminFrom.mockReturnValue(chain)
    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html></html>']))

    const res = await POST(makeRequest({ prompt: 'build something', projectId: 'proj-1' }))
    expect(res.status).toBe(200)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it('bypasses the rate limit for teachers even when over the hourly limit', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockIsTeacher.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 3, count: 20 })

    const chain = makeAdminChain({ data: VALID_PROJECT, error: null })
    const updateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
    chain.update.mockReturnValue(updateChain)
    mockAdminFrom.mockReturnValue(chain)
    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html></html>']))

    const res = await POST(makeRequest({ prompt: 'build something', projectId: 'proj-1' }))
    expect(res.status).toBe(200)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  // ---- Input validation -----------------------------------------------------

  it('returns 400 when prompt is missing', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })

    const res = await POST(makeRequest({ projectId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when projectId is missing', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })

    const res = await POST(makeRequest({ prompt: 'build a todo app' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when project does not belong to the user', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 5 })

    // SELECT filtered by id + user_id returns no row
    const chain = makeAdminChain({ data: null, error: null })
    mockAdminFrom.mockReturnValue(chain)

    const res = await POST(makeRequest({ prompt: 'build a todo app', projectId: 'p1' }))
    expect(res.status).toBe(404)
  })

  // ---- Happy path: streaming ------------------------------------------------

  it('streams HTML back and saves to DB on success', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 5 })

    const htmlChunks = ['<!DOCTYPE html>', '<html><body>', 'Hello</body></html>']

    // Admin DB: first call = project ownership check, rest = insert/update
    const chain = makeAdminChain({ data: VALID_PROJECT, error: null })
    chain.insert.mockResolvedValue({ error: null })
    // update chain needs to resolve after .eq()
    const updateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
    chain.update.mockReturnValue(updateChain)
    mockAdminFrom.mockReturnValue(chain)

    mockCreate.mockResolvedValue(makeStreamChunks(htmlChunks))

    const res = await POST(makeRequest({ prompt: 'build a todo app', projectId: 'proj-1' }))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text/)

    // Read the full streamed body
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      accumulated += decoder.decode(value, { stream: true })
    }

    expect(accumulated).toBe('<!DOCTYPE html><html><body>Hello</body></html>')
  })

  it('calls checkRateLimit with the authenticated user id', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 1, count: 20 })

    await POST(makeRequest({ prompt: 'test', projectId: 'p1' }))

    expect(mockCheckRateLimit).toHaveBeenCalledWith(AUTHED_USER.id)
  })

  it('logs the prompt to the DB before streaming', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })

    const chain = makeAdminChain({ data: VALID_PROJECT, error: null })
    const updateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
    chain.update.mockReturnValue(updateChain)
    mockAdminFrom.mockReturnValue(chain)

    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html><html></html>']))

    await POST(makeRequest({ prompt: 'make a clock', projectId: 'proj-1' }))

    // Verify insert was called with the prompt content
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: AUTHED_USER.id,
        project_id: 'proj-1',
        content: 'make a clock',
      })
    )
  })

  it('injects the project files into the system prompt, with line numbers', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })

    const chain = makeAdminChain({ data: VALID_PROJECT, error: null })
    const updateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
    chain.update.mockReturnValue(updateChain)
    mockAdminFrom.mockReturnValue(chain)

    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html><html></html>']))

    const existingCode = '<!DOCTYPE html><html><body>Old</body></html>'
    await POST(makeRequest({ prompt: 'add a button', projectId: 'proj-1', files: { 'index.html': existingCode } }))

    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')

    // The file arrives under the same `--- FILE: <name> ---` delimiter the
    // model is asked to reply with, and each line is numbered so the model
    // can refer to specific lines.
    expect(systemMessage.content).toContain('Current project files:')
    expect(systemMessage.content).toContain('--- FILE: index.html ---')
    expect(systemMessage.content).toContain(`1 | ${existingCode}`)
    expect(userMessage.content).toContain('add a button')
  })

  it('injects selectedCode into the user message, not the system prompt', async () => {
    mockGetSessionUser.mockResolvedValue(AUTHED_USER)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })

    const chain = makeAdminChain({ data: VALID_PROJECT, error: null })
    const updateChain = { eq: jest.fn().mockResolvedValue({ error: null }) }
    chain.update.mockReturnValue(updateChain)
    mockAdminFrom.mockReturnValue(chain)

    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html><html></html>']))

    const highlighted = '<button>Old</button>'
    await POST(makeRequest({ prompt: 'make it blue', projectId: 'proj-1', selectedCode: highlighted }))

    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')

    // Selection is per-turn context, so it belongs with the turn's prompt
    // rather than the system prompt, which is reused across the conversation.
    expect(userMessage.content).toContain('Selected code:')
    expect(userMessage.content).toContain(highlighted)
    expect(userMessage.content).toContain('make it blue')
    expect(systemMessage.content).not.toContain(highlighted)
  })
})
