/**
 * /api/projects/[id]/turn: DeepSeek is mocked, the database is real.
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
import { POST } from '@/app/api/projects/[id]/turn/route'
import { db } from '@/lib/db/client'
import { messages, projects } from '@/lib/db/schema'
import { makeProject, makeUser, resetDb, setLessonProgress } from '@/__tests__/helpers/db'
import { LESSONS, type LessonTask } from '@/lib/lessons'
import { taskPageId } from '@/lib/board/tasks'
import { toolsFor } from '@/lib/board/tools'
import { buildTaskNudge } from '@/lib/task-guard'
import {
  addDirectorLesson,
  DIRECTOR_LESSON,
  removeDirectorLesson,
} from '@/__tests__/fixtures/director-lesson'

const modelSays = (text: string, calls: [string, object][] = []) =>
  mockCreate.mockResolvedValueOnce({
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: text } }] }
      for (const [i, [name, args]] of calls.entries())
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: i, id: `c${i}`, function: { name, arguments: JSON.stringify(args) } },
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

const drain = async (res: Response) => {
  const events: { type: string }[] = []
  for (const line of (await res.text()).split('\n\n'))
    if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)))
  return events
}

describe('POST /api/projects/[id]/turn', () => {
  beforeEach(async () => {
    await resetDb()
    mockCreate.mockReset()
    mockCheckRateLimit.mockReset()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, count: 0 })
    mockIsAdmin.mockResolvedValue(false)
    mockIsTeacher.mockResolvedValue(false)
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
    const rows = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.projectId, project.id))
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
    mockCheckRateLimit.mockResolvedValue({ allowed: false, count: 30 })
    const limited = await post(project.id, { text: 'hi' })
    expect(limited.status).toBe(429)
    expect((await limited.json()).error).not.toMatch(/hour/i)
  })

  it.each([
    ['admin', mockIsAdmin],
    ['teacher', mockIsTeacher],
  ])('never rate limits staff (%s)', async (_, role) => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
    role.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, count: 30 })
    const project = await makeProject(user.id)
    modelSays('Hi.')
    const res = await post(project.id, { type: 'student_message', text: 'hi' })
    expect(res.status).toBe(200)
    await drain(res)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it('applies a code run to the persisted board and tells the tutor what happened', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
    const board = {
      pages: [{ id: 'p1', title: 'One', nodeIds: ['c1'] }],
      activePageId: 'p1',
      focusId: null,
      nodes: {
        c1: {
          id: 'c1',
          parentId: null,
          createdBy: 'tutor',
          type: 'code',
          language: 'python',
          source: 'print(1)',
          editable: true,
        },
      },
    }
    const project = await makeProject(user.id, { board })
    modelSays('Nice.')
    const run = {
      type: 'code_run_result',
      nodeId: 'c1',
      source: 'print("hi")',
      ok: true,
      stdout: 'hi\n',
      stderr: '',
    }
    expect((await drain(await post(project.id, run))).at(-1)?.type).toBe('turn.end')

    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    const saved = row.board as { nodes: Record<string, { source?: string; stdout?: string }> }
    expect(saved.nodes.c1.source).toBe('print("hi")')
    expect(saved.nodes.out_c1.stdout).toBe('hi\n')
    expect((row.files as Record<string, string>)['main.py']).toBe('print("hi")') // other readers use files, not the board
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

  // The reported bug: the tutor congratulated a student and announced the next
  // task while their board correctly refused to move on, because this route
  // never told the model which task was open or whether its checks passed.
  describe('the lesson guard', () => {
    const lesson = LESSONS[0] // Week #1 — Wake the Robot
    const nameTag = lesson.tasks.find((t) => t.id === 'name-tag')!
    const firstWords = lesson.tasks.find((t) => t.id === 'first-words')!
    const intro = lesson.tasks.find((t) => t.id === 'intro-3')!

    // A board holding one task page whose code node has `source`.
    const boardWith = (source: string) => ({
      pages: [{ id: taskPageId(nameTag), title: nameTag.chip, nodeIds: ['c1'] }],
      activePageId: taskPageId(nameTag),
      focusId: null,
      nodes: {
        c1: {
          id: 'c1',
          parentId: null,
          createdBy: 'student',
          type: 'code',
          language: 'python',
          source,
          editable: true,
        },
      },
    })

    const systemPrompt = () => mockCreate.mock.calls[0][0].messages[0].content as string

    const ask = async (source: string) => {
      const user = await makeUser()
      mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
      const project = await makeProject(user.id, {
        lessonId: lesson.id,
        lessonVersion: 3,
        files: { 'main.py': source },
        board: boardWith(source),
      })
      await setLessonProgress(project.id, [firstWords.id, 'intro-3'], new Date().toISOString())
      modelSays('ok')
      await drain(await post(project.id, { type: 'student_message', text: 'is it done?' }))
      return systemPrompt()
    }

    it('gives the tutor the rubric and the real evidence, and lets it judge', async () => {
      // Exactly the reported code: the variable is there, the f-string is not.
      const prompt = await ask('name = "Moral"\nprint(name)')

      expect(prompt).toContain('"Save your name"')
      expect(prompt).toContain('- You greet with an f-string')
      expect(prompt).toContain('EVIDENCE')
      expect(prompt).toContain('name = "Moral"')
      expect(prompt).toContain('YOU decide when this task is finished')
    })

    it('names the open task and marks the finished one done', async () => {
      const prompt = await ask('name = "Moral"\nprint(name)')
      expect(prompt).toContain(`[done] ${firstWords.chip}`)
      expect(prompt).toContain(`[done] ${intro.chip}`)
      expect(prompt).toContain(`[OPEN] ${nameTag.chip}`)
      expect(prompt).toContain('never announce or start the next task')
      expect(
        mockCreate.mock.calls[0][0].tools.map(
          (t: { function: { name: string } }) => t.function.name
        )
      ).toContain('task_complete')
    })

    it('withholds board_new_page in a lesson, since pages belong to tasks', async () => {
      await ask('name = "Moral"')
      const tools = mockCreate.mock.calls[0][0].tools as { function: { name: string } }[]
      expect(tools.map((t) => t.function.name)).not.toContain('board_new_page')
    })

    it('leaves a free-form board its own pages and no nudge', async () => {
      const user = await makeUser()
      mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: '' })
      const project = await makeProject(user.id, { lessonId: null, lessonVersion: null })
      modelSays('ok')
      await drain(await post(project.id, { type: 'student_message', text: 'hi' }))

      const tools = mockCreate.mock.calls[0][0].tools as { function: { name: string } }[]
      expect(tools.map((t) => t.function.name)).toContain('board_new_page')
      expect(systemPrompt()).not.toContain('EVIDENCE')
      expect(tools.map((t) => t.function.name)).not.toContain('task_complete')
    })
  })

  describe('Bolt (director lessons only)', () => {
    beforeAll(addDirectorLesson)
    afterAll(removeDirectorLesson)
    const task = DIRECTOR_LESSON.tasks[0]
    const systemPrompt = () => mockCreate.mock.calls[0][0].messages[0].content as string
    const bolt = {
      id: 'bolt_1',
      parentId: null,
      createdBy: 'system',
      type: 'helper',
      request: 'make a game',
      source: 'print("game")',
    }
    const boardOf = (lessonTask: LessonTask) => ({
      pages: [{ id: taskPageId(lessonTask), title: lessonTask.chip, nodeIds: ['c1', 'bolt_1'] }],
      activePageId: taskPageId(lessonTask),
      focusId: null,
      nodes: {
        c1: {
          id: 'c1',
          parentId: null,
          createdBy: 'student',
          type: 'code',
          language: 'python',
          source: 'print("mine")',
          editable: true,
        },
        bolt_1: bolt,
      },
    })
    const start = async (lessonId: number, lessonTask: LessonTask) => {
      const user = await makeUser()
      mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
      const project = await makeProject(user.id, { lessonId, board: boardOf(lessonTask) })
      return { user, project }
    }

    it('a tutor lesson has no Bolt text and the same tools as before', async () => {
      const nameTag = LESSONS[0].tasks.find((t) => t.id === 'name-tag')!
      const { project } = await start(LESSONS[0].id, nameTag)
      await setLessonProgress(project.id, ['first-words', 'intro-3'], new Date().toISOString())
      modelSays('ok')
      await drain(await post(project.id, { type: 'student_message', text: 'hi' }))
      expect(systemPrompt()).not.toMatch(/Bolt|helper_event|bolt_exchange|# ask:/)
      expect(mockCreate.mock.calls[0][0].tools).toEqual(toolsFor(true, true))
    })

    it('Week 8, a real director lesson, tells Sparky to read the notes and the ask first', async () => {
      const week8 = LESSONS.find((l) => l.id === 108)!
      expect(week8.aiPolicy).toBe('director')
      const { project } = await start(week8.id, week8.tasks[0])
      modelSays('ok')
      await drain(await post(project.id, { type: 'student_message', text: 'hi' }))
      expect(systemPrompt()).toContain('Code counts only once the student explains it')
      expect(systemPrompt()).toContain('"# ask:" line')
    })

    it('marks helper rows as Bolt exchanges and never counts them as stuck turns', async () => {
      const { user, project } = await start(DIRECTOR_LESSON.id, task)
      for (let i = 0; i < 5; i++)
        await db.insert(messages).values({
          projectId: project.id,
          userId: user.id,
          role: 'helper',
          content: `Asked Bolt: thing ${i}\nBolt wrote:\nprint(${i})`,
          createdAt: new Date(Date.now() - 10_000 + i).toISOString(),
        })
      modelSays('ok')
      await drain(await post(project.id, { type: 'student_message', text: 'hi' }))

      const sent = mockCreate.mock.calls[0][0].messages as { role: string; content: string }[]
      const exchanges = sent.filter((m) => m.content.startsWith('<bolt_exchange>'))
      expect(exchanges).toHaveLength(5)
      expect(exchanges[0].content).toContain('Asked Bolt: thing 0')
      // Five messages from the student would be tier 3; five to Bolt leave it at tier 1.
      expect(systemPrompt()).not.toContain(buildTaskNudge(task, 2))
      expect(systemPrompt()).not.toContain(buildTaskNudge(task, 3))
      expect(systemPrompt()).toContain('Bolt, a separate helper robot')
    })

    it('helper_result shows Sparky the request and the code, with no tools', async () => {
      const { project } = await start(DIRECTOR_LESSON.id, task)
      modelSays('Does it do what you asked?')
      const res = await post(project.id, { type: 'helper_result', nodeId: 'bolt_1' })
      expect(res.status).toBe(200)
      await drain(res)

      const call = mockCreate.mock.calls[0][0]
      expect(call.tools).toBeUndefined()
      const last = call.messages.at(-1).content as string
      expect(last).toContain('<helper_event>')
      expect(last).toContain('make a game')
      expect(last).toContain('print(\\"game\\")')
      const rows = await db
        .select({ role: messages.role })
        .from(messages)
        .where(eq(messages.projectId, project.id))
      expect(rows.map((r) => r.role)).toEqual(['assistant'])
    })

    it('400s a helper_result for a node that is not a Bolt block', async () => {
      const { project } = await start(DIRECTOR_LESSON.id, task)
      expect((await post(project.id, { type: 'helper_result', nodeId: 'c1' })).status).toBe(400)
      expect((await post(project.id, { type: 'helper_result', nodeId: 'nope' })).status).toBe(400)
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })
})
