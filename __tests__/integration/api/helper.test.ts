/**
 * /api/projects/[id]/helper (Bolt): DeepSeek is mocked, the database is real.
 */
const mockGetSessionUser = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockIsAdmin = jest.fn()
const mockIsTeacher = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))
jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
}))
jest.mock('@/lib/auth/permissions', () => ({
  isAdmin: (...a: unknown[]) => mockIsAdmin(...a),
  isTeacher: (...a: unknown[]) => mockIsTeacher(...a),
}))
jest.mock('@/lib/deepseek', () => ({
  deepseek: { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } },
  MODEL: 'm',
}))
jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { eq } from 'drizzle-orm'
import { POST } from '@/app/api/projects/[id]/helper/route'
import { db } from '@/lib/db/client'
import { messages, projects, prompts } from '@/lib/db/schema'
import { makeProject, makeUser, resetDb } from '@/__tests__/helpers/db'
import {
  addDirectorLesson,
  DIRECTOR_LESSON,
  removeDirectorLesson,
} from '@/__tests__/fixtures/director-lesson'
import type { BoardState } from '@/lib/board/reducer'

const writes = (code: string, caption = 'It prints game.') =>
  mockCreate.mockResolvedValueOnce({
    async *[Symbol.asyncIterator]() {
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'c0',
                  function: { name: 'write_code', arguments: JSON.stringify({ code, caption }) },
                },
              ],
            },
          },
        ],
      }
    },
  })

const post = (id: string, body: object) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  })

const board: BoardState = {
  pages: [
    { id: 't_dir-1', title: 'ZEBRA_TASK_CHIP', nodeIds: ['code_dir-1'] },
    { id: 't_other', title: 'Other', nodeIds: ['code_other'] },
  ],
  activePageId: 't_dir-1',
  focusId: null,
  nodes: {
    'code_dir-1': {
      id: 'code_dir-1',
      parentId: null,
      createdBy: 'student',
      type: 'code',
      language: 'python',
      source: 'name = "Mia"\nprint(name)',
      editable: true,
    },
    code_other: {
      id: 'code_other',
      parentId: null,
      createdBy: 'student',
      type: 'code',
      language: 'python',
      source: 'print("ZEBRA_OTHER_PAGE")',
      editable: true,
    },
  },
}

const long = Array.from({ length: 9 }, (_, i) => `print(${i})`).join('\n')

async function setup() {
  const user = await makeUser()
  mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
  const project = await makeProject(user.id, { lessonId: DIRECTOR_LESSON.id, board })
  return { user, project }
}

const helperRows = (projectId: string) =>
  db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.projectId, projectId))

describe('POST /api/projects/[id]/helper', () => {
  beforeAll(addDirectorLesson)
  afterAll(removeDirectorLesson)
  beforeEach(async () => {
    await resetDb()
    mockCreate.mockReset()
    mockCheckRateLimit.mockReset()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, count: 0 })
    mockIsAdmin.mockResolvedValue(false)
    mockIsTeacher.mockResolvedValue(false)
  })

  it('builds the block on the page, saves it, and logs a helper row and a bolt prompt', async () => {
    const { user, project } = await setup()
    writes('```python\nprint("game")\n```')

    const res = await post(project.id, { request: 'make a game', pageId: 't_dir-1' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.caption).toBe('It prints game.')
    expect(body.op).toMatchObject({
      op: 'add',
      pageId: 't_dir-1',
      node: { type: 'helper', request: 'make a game', source: 'print("game")' },
    })

    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    const saved = row.board as BoardState
    expect(saved.pages[0].nodeIds).toContain(body.op.node.id)
    expect(saved.nodes[body.op.node.id]).toMatchObject({ type: 'helper', source: 'print("game")' })

    const rows = await helperRows(project.id)
    expect(rows).toEqual([
      { role: 'helper', content: 'Asked Bolt: make a game\nBolt wrote:\nprint("game")' },
    ])
    const [log] = await db.select().from(prompts).where(eq(prompts.userId, user.id))
    expect(log.context).toMatchObject({ tutor: 'bolt' })

    const call = mockCreate.mock.calls[0][0]
    expect(call.tool_choice).toEqual({ type: 'function', function: { name: 'write_code' } })
    expect(call.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual([
      'write_code',
    ])
  })

  it('shows the model the request and that page’s code, never the task, checks or chat', async () => {
    const { user, project } = await setup()
    await db
      .insert(messages)
      .values({ projectId: project.id, userId: user.id, role: 'user', content: 'ZEBRA_CHAT' })
    writes(long)
    writes('print("game")')

    await post(project.id, { request: 'make a game', pageId: 't_dir-1' })
    const seen = JSON.stringify(mockCreate.mock.calls)
    expect(seen).toContain('make a game')
    expect(seen).toContain('print(name)')
    for (const secret of [
      'ZEBRA_TASK_GOAL',
      'ZEBRA_TASK_CHIP',
      'ZEBRA_TASK_SUCCESS',
      'ZEBRA_CHECK',
      'ZEBRA_LESSON_DESCRIPTION',
      'ZEBRA_CHAT',
      'ZEBRA_OTHER_PAGE',
    ])
      expect(seen).not.toContain(secret)
  })

  it('shows only the task’s own block of a shared file', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
    const shared: BoardState = {
      ...board,
      nodes: {
        ...board.nodes,
        'code_dir-1': {
          ...(board.nodes['code_dir-1'] as Extract<BoardState['nodes'][string], { type: 'code' }>),
          anchor: 'TASK: dir-1',
          source: '# TASK: earlier\nprint("ZEBRA_EARLIER_TASK")\n\n# TASK: dir-1\nprint(name)\n',
        },
      },
    }
    const project = await makeProject(user.id, { lessonId: DIRECTOR_LESSON.id, board: shared })
    writes('print("game")')

    await post(project.id, { request: 'make a game', pageId: 't_dir-1' })
    const seen = JSON.stringify(mockCreate.mock.calls)
    expect(seen).toContain('print(name)')
    expect(seen).not.toContain('ZEBRA_EARLIER_TASK')
  })

  it('tells the model when the code is over 8 lines, and takes its shorter retry', async () => {
    const { project } = await setup()
    writes(long)
    writes('print("game")')

    const body = await (
      await post(project.id, { request: 'make a game', pageId: 't_dir-1' })
    ).json()
    expect(mockCreate).toHaveBeenCalledTimes(2)
    const retry = JSON.stringify(mockCreate.mock.calls[1][0].messages)
    expect(retry).toMatch(/9 lines\. The limit is 8/)
    expect(body.op.node.source).toBe('print("game")')
  })

  it('gives up after 2 retries: no block, and asks for a smaller piece', async () => {
    const { project } = await setup()
    writes(long)
    writes(long)
    writes(long)

    const body = await (
      await post(project.id, { request: 'make a game', pageId: 't_dir-1' })
    ).json()
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(body.op).toBeNull()
    expect(body.caption).toMatch(/smaller piece/)
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    expect(Object.values((row.board as BoardState).nodes).some((n) => n.type === 'helper')).toBe(
      false
    )
    const rows = await helperRows(project.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toMatch(/^Asked Bolt: make a game\nBolt wrote no code: /)
  })

  it('sends a commented reply back, and takes the retry without comments', async () => {
    const { project } = await setup()
    writes('# a pet\nprint("pet")')
    writes('print("pet")')

    const body = await (await post(project.id, { request: 'make a pet', pageId: 't_dir-1' })).json()
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(mockCreate.mock.calls[1][0].messages)).toMatch(/has a comment/)
    expect(body.op.node.source).toBe('print("pet")')
  })

  it('gives up on code that is still commented after 2 retries: no block, could not build', async () => {
    const { project } = await setup()
    writes(long) // too big first: the final caption is still the comment failure
    writes('print("pet")  # says pet')
    writes('print("#1")  # hi')

    const body = await (await post(project.id, { request: 'make a pet', pageId: 't_dir-1' })).json()
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(body.op).toBeNull()
    expect(body.caption).toMatch(/could not build/)
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    expect(Object.values((row.board as BoardState).nodes).some((n) => n.type === 'helper')).toBe(
      false
    )
  })

  it.each([
    'print("#1 pet")',
    `print("I'm #1")`,
    "print('it\\'s #1')",
    'print("""line one\n# still a string""")',
  ])('accepts a # inside a string: %s', async (code) => {
    const { project } = await setup()
    writes(code)

    const body = await (await post(project.id, { request: 'make a pet', pageId: 't_dir-1' })).json()
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(body.op.node.source).toBe(code)
  })

  it("treats a # after an escaped quote as a comment: 'it\\'s'  # note", async () => {
    const { project } = await setup()
    for (let i = 0; i < 3; i++) writes("print('it\\'s')  # note")

    const body = await (await post(project.id, { request: 'make a pet', pageId: 't_dir-1' })).json()
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(body.op).toBeNull()
  })

  it('403s a tutor lesson and a project with no lesson', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
    const week1 = await makeProject(user.id, { board }) // lesson 101, a tutor lesson
    const none = await makeProject(user.id, { lessonId: null, board })
    for (const p of [week1, none])
      expect((await post(p.id, { request: 'make a game', pageId: 't_dir-1' })).status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('401s signed out, 404s a bad or foreign id, 400s a bad body, 429s when limited', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    expect((await post('x', { request: 'hi', pageId: 't_dir-1' })).status).toBe(401)

    const { project } = await setup()
    expect((await post('not-a-uuid', { request: 'hi', pageId: 't_dir-1' })).status).toBe(404)
    for (const bad of [
      {},
      { request: '   ', pageId: 't_dir-1' },
      { request: 'x'.repeat(501), pageId: 't_dir-1' },
      { request: 'hi', pageId: 7 },
      { request: 'hi', pageId: 'no_such_page' },
    ])
      expect((await post(project.id, bad)).status).toBe(400)

    const stranger = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: stranger.id, email: stranger.email, name: '' })
    expect((await post(project.id, { request: 'hi', pageId: 't_dir-1' })).status).toBe(404)

    mockCheckRateLimit.mockResolvedValue({ allowed: false, count: 30 })
    expect((await post(project.id, { request: 'hi', pageId: 't_dir-1' })).status).toBe(429)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['admin', mockIsAdmin],
    ['teacher', mockIsTeacher],
  ])('never rate limits staff (%s)', async (_, role) => {
    const { project } = await setup()
    role.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, count: 30 })
    writes('print("game")')
    expect((await post(project.id, { request: 'make a game', pageId: 't_dir-1' })).status).toBe(200)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })
})
