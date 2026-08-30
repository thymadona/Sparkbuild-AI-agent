/**
 * Integration tests for the /api/generate route handler.
 *
 * DeepSeek is mocked — it is an external paid service. The database is not:
 * project ownership is a `where` predicate now, and the prompt log and chat
 * messages are rows worth asserting on directly.
 */

const mockGetSessionUser = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockCreate = jest.fn()
const mockIsAdmin = jest.fn()
const mockIsTeacher = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  getSessionUser: () => mockGetSessionUser(),
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

import { eq } from 'drizzle-orm'
import { POST } from '@/app/api/generate/route'
import { db } from '@/lib/db/client'
import { messages, projects, prompts } from '@/lib/db/schema'
import { makeProject, makeUser, resetDb } from '@/__tests__/helpers/db'

function makeRequest(body: object) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Drains a streamed response so the route's after-stream writes complete. */
async function drain(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    accumulated += decoder.decode(value, { stream: true })
  }
  return accumulated
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

beforeEach(async () => {
  jest.clearAllMocks()
  mockIsAdmin.mockResolvedValue(false)
  mockIsTeacher.mockResolvedValue(false)
  await resetDb()
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
    mockGetSessionUser.mockResolvedValue(await makeUser())
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 3, count: 10 })

    const res = await POST(makeRequest({ prompt: 'build something', projectId: 'p1' }))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toMatch(/hourly limit/i)
    expect(json.error).toMatch(/3 hour/)
  })

  it('bypasses the rate limit for admins even when over the hourly limit', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockIsAdmin.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 3, count: 20 })
    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html></html>']))

    const res = await POST(makeRequest({ prompt: 'build something', projectId: project.id }))
    expect(res.status).toBe(200)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
    await drain(res)
  })

  it('bypasses the rate limit for teachers even when over the hourly limit', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockIsTeacher.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 3, count: 20 })
    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html></html>']))

    const res = await POST(makeRequest({ prompt: 'build something', projectId: project.id }))
    expect(res.status).toBe(200)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
    await drain(res)
  })

  // ---- Input validation -----------------------------------------------------

  it('returns 400 when prompt is missing', async () => {
    mockGetSessionUser.mockResolvedValue(await makeUser())
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })

    const res = await POST(makeRequest({ projectId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when projectId is missing', async () => {
    mockGetSessionUser.mockResolvedValue(await makeUser())
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })

    const res = await POST(makeRequest({ prompt: 'build a todo app' }))
    expect(res.status).toBe(400)
  })

  // A mistyped project id used to be absorbed by PostgREST and answered 404.
  // Postgres raises 22P02 for it, so the route guards the value itself.
  it('returns 404 when projectId is not a uuid', async () => {
    mockGetSessionUser.mockResolvedValue(await makeUser())
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 5 })

    const res = await POST(makeRequest({ prompt: 'build a todo app', projectId: 'p1' }))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the project belongs to a different user', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(intruder)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 5 })

    const res = await POST(makeRequest({ prompt: 'build a todo app', projectId: project.id }))
    expect(res.status).toBe(404)
  })

  // ---- Happy path: streaming ------------------------------------------------

  it('streams the model output back to the client', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 5 })
    mockCreate.mockResolvedValue(
      makeStreamChunks(['<!DOCTYPE html>', '<html><body>', 'Hello</body></html>'])
    )

    const res = await POST(makeRequest({ prompt: 'build a todo app', projectId: project.id }))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text/)
    expect(await drain(res)).toBe('<!DOCTYPE html><html><body>Hello</body></html>')
  })

  it('persists the user and assistant messages once the stream finishes', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 5 })
    mockCreate.mockResolvedValue(makeStreamChunks(['Try adding a button.']))

    await drain(await POST(makeRequest({ prompt: 'how do I add a button?', projectId: project.id })))

    const rows = await db.select().from(messages).where(eq(messages.projectId, project.id))
    expect(rows.map((r) => r.role).sort()).toEqual(['assistant', 'user'])
    expect(rows.find((r) => r.role === 'user')!.content).toBe('how do I add a button?')
  })

  it('calls checkRateLimit with the authenticated user id', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue(user)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 1, count: 20 })

    await POST(makeRequest({ prompt: 'test', projectId: 'p1' }))

    expect(mockCheckRateLimit).toHaveBeenCalledWith(user.id)
  })

  it('logs the prompt to the DB before streaming', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })
    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html><html></html>']))

    // Asserted before the stream is drained: `prompts` is the permanent log
    // and is written on the way in, not as part of the stream's completion.
    await POST(makeRequest({ prompt: 'make a clock', projectId: project.id }))

    const rows = await db.select().from(prompts).where(eq(prompts.projectId, project.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toBe('make a clock')
    expect(rows[0].userId).toBe(user.id)
  })

  it('writes parsed build output back to the project files', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockIsAdmin.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })
    mockCreate.mockResolvedValue(
      makeStreamChunks([
        '--- FILE: index.html ---\n<h1>Hi</h1>\n--- DONE ---\n',
        'Built you a heading.',
      ])
    )

    await drain(await POST(makeRequest({ prompt: 'make a heading', projectId: project.id, mode: 'build' })))

    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    expect(row.files).toEqual({ 'index.html': '<h1>Hi</h1>' })
  })

  it('injects the project files into the system prompt, with line numbers', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })
    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html><html></html>']))

    const existingCode = '<!DOCTYPE html><html><body>Old</body></html>'
    const res = await POST(
      makeRequest({
        prompt: 'add a button',
        projectId: project.id,
        files: { 'index.html': existingCode },
      })
    )

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
    await drain(res)
  })

  it('injects selectedCode into the user message, not the system prompt', async () => {
    const user = await makeUser()
    const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
    mockGetSessionUser.mockResolvedValue(user)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })
    mockCreate.mockResolvedValue(makeStreamChunks(['<!DOCTYPE html><html></html>']))

    const highlighted = '<button>Old</button>'
    const res = await POST(
      makeRequest({ prompt: 'make it blue', projectId: project.id, selectedCode: highlighted })
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')

    // Selection is per-turn context, so it belongs with the turn's prompt
    // rather than the system prompt, which is reused across the conversation.
    expect(userMessage.content).toContain('Selected code:')
    expect(userMessage.content).toContain(highlighted)
    expect(userMessage.content).toContain('make it blue')
    expect(systemMessage.content).not.toContain(highlighted)
    await drain(res)
  })
})
