/**
 * /api/projects/[id]/turn: DeepSeek is mocked, the database is real.
 */
const mockGetSessionUser = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))
jest.mock('@/lib/ratelimit', () => ({ checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a) }))
jest.mock('@/lib/auth/permissions', () => ({ isAdmin: async () => false, isTeacher: async () => false }))
jest.mock('@/lib/gemini', () => ({ deepseek: { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } }, MODEL: 'm' }))
jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { eq } from 'drizzle-orm'
import { POST } from '@/app/api/projects/[id]/turn/route'
import { db } from '@/lib/db/client'
import { messages, projects } from '@/lib/db/schema'
import { makeProject, makeUser, resetDb } from '@/__tests__/helpers/db'

const modelSays = (text: string, calls: [string, object][] = []) =>
  mockCreate.mockResolvedValueOnce({
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: text } }] }
      for (const [i, [name, args]] of calls.entries())
        yield { choices: [{ delta: { tool_calls: [{ index: i, id: `c${i}`, function: { name, arguments: JSON.stringify(args) } }] } }] }
    },
  })

const post = (id: string, body: object) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })

const drain = async (res: Response) => {
  const events: { type: string }[] = []
  for (const line of (await res.text()).split('\n\n')) if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)))
  return events
}

describe('POST /api/projects/[id]/turn', () => {
  beforeEach(async () => {
    await resetDb()
    mockCreate.mockReset()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, hoursUntilReset: 0 })
  })

  it('streams captions, applies the board op, and persists board and messages', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
    const project = await makeProject(user.id)
    modelSays('Hi Mia!', [['board_new_page', { pageId: 'p1', title: 'One' }]])

    const res = await post(project.id, { type: 'student_message', text: 'hello' })
    const events = await drain(res)

    expect(events.at(-1)?.type).toBe('turn.end')
    expect(events.some((e) => e.type === 'caption.delta')).toBe(true)
    expect(events.some((e) => e.type === 'board.op')).toBe(true)
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    expect((row.board as { pages: unknown[] }).pages).toHaveLength(1)
    const rows = await db.select({ role: messages.role, content: messages.content }).from(messages).where(eq(messages.projectId, project.id))
    expect(rows.map((r) => r.role).sort()).toEqual(['assistant', 'user'])
  })

  it("404s for someone else's project and never calls the model", async () => {
    const owner = await makeUser()
    const other = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue({ id: other.id, email: other.email, name: '' })
    expect((await post(project.id, { type: 'student_message', text: 'hi' })).status).toBe(404)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('401s signed out, 404s a malformed id, 429s when rate limited', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    expect((await post('x', { text: 'hi' })).status).toBe(401)
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
    expect((await post('not-a-uuid', { text: 'hi' })).status).toBe(404)
    const project = await makeProject(user.id)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, hoursUntilReset: 1 })
    expect((await post(project.id, { text: 'hi' })).status).toBe(429)
  })

  it('applies a code run to the persisted board and tells the tutor what happened', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
    const board = {
      pages: [{ id: 'p1', title: 'One', nodeIds: ['c1'] }], activePageId: 'p1', focusId: null,
      nodes: { c1: { id: 'c1', parentId: null, createdBy: 'tutor', type: 'code', language: 'python', source: 'print(1)', editable: true, highlightLines: [] } },
    }
    const project = await makeProject(user.id, { board })
    modelSays('Nice.')
    const run = { type: 'code_run_result', nodeId: 'c1', source: 'print("hi")', ok: true, stdout: 'hi\n', stderr: '' }
    expect((await drain(await post(project.id, run))).at(-1)?.type).toBe('turn.end')

    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    const saved = row.board as { nodes: Record<string, { source?: string; stdout?: string }> }
    expect(saved.nodes.c1.source).toBe('print("hi")')
    expect(saved.nodes.out_c1.stdout).toBe('hi\n')
    expect((row.files as Record<string, string>)['index.html']).toBe('print("hi")') // share/fork read files, not the board
    expect(JSON.stringify(mockCreate.mock.calls[0][0].messages.at(-1))).toContain('code_run')

    expect((await post(project.id, { ...run, nodeId: 'nope' })).status).toBe(400)
    expect((await post(project.id, { type: 'bogus' })).status).toBe(400)
  })

  it('reports a model failure as an error event without crashing', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
    const project = await makeProject(user.id)
    mockCreate.mockRejectedValueOnce(new Error('boom'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const events = await drain(await post(project.id, { type: 'student_message', text: 'hi' }))
    expect(events.at(-1)).toMatchObject({ type: 'error' })
  })
})
