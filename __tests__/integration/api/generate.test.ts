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
import { makeMessages, makeProject, makeUser, resetDb, setLessonProgress } from '@/__tests__/helpers/db'

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

  // ---- Ask-mode stuck-loop escalation ---------------------------------------
  //
  // Regression coverage for a real transcript: a student sent "help me replace
  // the name and intro" 20+ times over ~24h on lesson 1's `identity` task and
  // got the same reworded nudge every time, even after typing "how?" and
  // "i don't know". These tests pin the fix: the tutor must escalate to a
  // materially different tier after 2-3 unresolved turns, and confusion
  // phrases must short-circuit straight to the strongest tier.

  describe('ask-mode escalation', () => {
    const ISO = (minute: number) => new Date(Date.UTC(2020, 0, 1, 0, minute)).toISOString()

    async function systemPromptFor(user: Awaited<ReturnType<typeof makeUser>>, projectId: string, prompt: string) {
      mockCreate.mockResolvedValue(makeStreamChunks(['Try that.']))
      const res = await POST(makeRequest({ prompt, projectId, mode: 'ask' }))
      const callArgs = mockCreate.mock.calls[0][0]
      const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
      await drain(res)
      return systemMessage.content as string
    }

    beforeEach(() => {
      mockGetSessionUser.mockClear()
      mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0, count: 0 })
    })

    it('stays at tier 1 on the first turn (no escalation markers)', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)

      const system = await systemPromptFor(user, project.id, 'help me replace the name and intro')

      expect(system).toContain('TASK: identity')
      expect(system).not.toContain('ESCALATION LEVEL')
    })

    it('escalates to tier 2 by the third turn', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)
      // Deliberately varied wording (not a verbatim repeat) so this isolates
      // the turn-count path from the exact-repeat confusion short-circuit.
      await makeMessages(project.id, user.id, [
        { role: 'user', content: 'help me replace the name and intro', createdAt: ISO(1) },
        { role: 'assistant', content: 'Find line 44, type your name.', createdAt: ISO(2) },
        { role: 'user', content: 'still not sure what to type', createdAt: ISO(3) },
        { role: 'assistant', content: 'Type your name on line 44.', createdAt: ISO(4) },
      ])

      const system = await systemPromptFor(user, project.id, 'ok what next')

      expect(system).toContain('ESCALATION LEVEL 2')
      expect(system).not.toContain('ESCALATION LEVEL 3')
    })

    it('escalates to tier 3 by the fifth turn', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)
      await makeMessages(
        project.id,
        user.id,
        Array.from({ length: 4 }, (_, i) => ({
          role: 'assistant' as const,
          content: `Find line 44, type your name. (nudge ${i})`,
          createdAt: ISO(i + 1),
        }))
      )

      const system = await systemPromptFor(user, project.id, 'help me replace the name and intro')

      expect(system).toContain('ESCALATION LEVEL 3')
      expect(system).not.toContain('ESCALATION LEVEL 2')
    })

    it.each(['how?', "i don't know"])(
      'short-circuits straight to tier 3 when the student says "%s", even on turn 1',
      async (confusedMessage) => {
        const user = await makeUser()
        const project = await makeProject(user.id)
        mockGetSessionUser.mockResolvedValue(user)

        const system = await systemPromptFor(user, project.id, confusedMessage)

        expect(system).toContain('ESCALATION LEVEL 3')
      }
    )

    it('short-circuits to tier 3 when the student repeats their previous message verbatim', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)
      await makeMessages(project.id, user.id, [
        { role: 'user', content: 'help me replace the name and intro', createdAt: ISO(1) },
      ])

      const system = await systemPromptFor(user, project.id, 'help me replace the name and intro')

      expect(system).toContain('ESCALATION LEVEL 3')
    })

    it('resets the counter once the task is marked complete, at tier 1 for the next task', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)
      await makeMessages(
        project.id,
        user.id,
        Array.from({ length: 5 }, (_, i) => ({
          role: 'assistant' as const,
          content: `Find line 44, type your name. (nudge ${i})`,
          createdAt: ISO(i + 1),
        }))
      )
      await setLessonProgress(project.id, ['identity'], ISO(10))

      const system = await systemPromptFor(user, project.id, 'how do I pick an interest?')

      expect(system).toContain('TASK: interests')
      expect(system).not.toContain('ESCALATION LEVEL')
    })

    it('uses success framing instead of a nudge right after a task completes', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)
      await setLessonProgress(project.id, ['identity'], ISO(1))

      const system = await systemPromptFor(user, project.id, 'what do I do next?')

      expect(system).toContain('THE STUDENT JUST FINISHED: "Write your intro"')
      expect(system).not.toContain('ESCALATION LEVEL')
    })

    it('caps homework at tier 2, never revealing the answer at tier 3', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)
      await setLessonProgress(project.id, ['identity', 'interests', 'palette'], ISO(1))
      await makeMessages(
        project.id,
        user.id,
        Array.from({ length: 6 }, (_, i) => ({
          role: 'assistant' as const,
          content: `Add one more chip. (nudge ${i})`,
          createdAt: ISO(i + 2),
        }))
      )

      const system = await systemPromptFor(user, project.id, 'i still dont get it')

      expect(system).toContain('ESCALATION LEVEL 2')
      expect(system).not.toContain('ESCALATION LEVEL 3')
      expect(system).toMatch(/hint only/i)
    })

    it('regression: the original stuck transcript escalates and never falls back to a flat repeat', async () => {
      const user = await makeUser()
      const project = await makeProject(user.id)
      mockGetSessionUser.mockResolvedValue(user)
      await makeMessages(project.id, user.id, [
        { role: 'user', content: 'help me replace the name and intro', createdAt: ISO(1) },
        { role: 'assistant', content: 'Find line 44, type your name.', createdAt: ISO(2) },
        { role: 'user', content: 'help me replace the name and intro', createdAt: ISO(3) },
        { role: 'assistant', content: 'Type your name on line 44.', createdAt: ISO(4) },
        { role: 'user', content: 'how?', createdAt: ISO(5) },
        { role: 'assistant', content: 'Find line 44, type your name.', createdAt: ISO(6) },
        { role: 'user', content: 'how?', createdAt: ISO(7) },
        { role: 'assistant', content: 'Look at line 44 and type your name there.', createdAt: ISO(8) },
        { role: 'user', content: "i don't know", createdAt: ISO(9) },
        { role: 'assistant', content: 'Find line 44, type your name.', createdAt: ISO(10) },
      ])

      const system = await systemPromptFor(user, project.id, 'help me replace the name and intro')
      expect(system).toContain('ESCALATION LEVEL 3')

      // Even after many more unresolved turns, tier 3 is the ceiling — the
      // student must never fall back to the original flat-repeat behavior.
      await makeMessages(
        project.id,
        user.id,
        Array.from({ length: 15 }, (_, i) => ({
          role: 'assistant' as const,
          content: `Find line 44, type your name. (nudge ${i})`,
          createdAt: ISO(11 + i),
        }))
      )
      const systemLater = await systemPromptFor(user, project.id, 'help me replace the name and intro')
      expect(systemLater).toContain('ESCALATION LEVEL 3')
      expect(systemLater).not.toContain('ESCALATION LEVEL 2')
    })
  })
})
