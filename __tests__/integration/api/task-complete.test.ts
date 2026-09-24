/**
 * The tutor decides a task is done; the turn route checks and records it.
 * DeepSeek is mocked (it plays the tutor's verdict), the database is real.
 */
const mockGetSessionUser = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))
jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: async () => ({ allowed: true, count: 0 }),
}))
jest.mock('@/lib/auth/permissions', () => ({
  isAdmin: async () => false,
  isTeacher: async () => false,
}))
jest.mock('@/lib/deepseek', () => ({
  deepseek: { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } },
  MODEL: 'm',
}))
jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { eq } from 'drizzle-orm'
import { POST } from '@/app/api/projects/[id]/turn/route'
import { db } from '@/lib/db/client'
import { activityDays, lessonProgress, projects, taskProgress } from '@/lib/db/schema'
import { LESSONS } from '@/lib/lessons'
import { taskPageId } from '@/lib/board/tasks'
import { makeProject, makeUser, resetDb, setLessonProgress } from '@/__tests__/helpers/db'

const lesson = LESSONS[0]
const task = lesson.tasks.find((t) => t.id === 'name-tag')!
const DONE = 'name = "Moral"\nprint(f"Hi {name}")\n'
const HALF = 'name = "Moral"\nprint("Hi")\n'

const board = (source: string, output?: string) => ({
  pages: [
    {
      id: taskPageId(task),
      title: task.chip,
      nodeIds: output === undefined ? ['c1'] : ['c1', 'o1'],
    },
  ],
  activePageId: taskPageId(task),
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
    ...(output === undefined
      ? {}
      : {
          o1: {
            id: 'o1',
            parentId: null,
            createdBy: 'system',
            type: 'output',
            forNodeId: 'c1',
            stdout: output,
            stderr: '',
            ok: true,
          },
        }),
  },
})

const verdict = (calls: [string, object][]) =>
  mockCreate.mockResolvedValueOnce({
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: 'Nice.' } }] }
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
const complete = (taskId = task.id) => verdict([['task_complete', { taskId, reason: 'done' }]])

const post = (id: string, body: object) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  })
const drain = async (res: Response) =>
  (await res.text())
    .split('\n\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)) as { type: string; completedTaskIds?: string[] })
const run = (source: string, stdout: string) => ({
  type: 'code_run_result',
  nodeId: 'c1',
  source,
  ok: true,
  stdout,
  stderr: '',
})

const setup = async (source: string, output?: string, done = ['first-words', 'intro-3']) => {
  const user = await makeUser()
  mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
  const project = await makeProject(user.id, {
    lessonId: lesson.id,
    lessonVersion: 3,
    files: { 'main.py': source },
    board: board(source, output),
  })
  await setLessonProgress(project.id, done, new Date().toISOString())
  return { user, project }
}
const progressOf = async (id: string) =>
  (
    await db
      .select({ ids: lessonProgress.completedTaskIds })
      .from(lessonProgress)
      .where(eq(lessonProgress.projectId, id))
  )[0]?.ids

beforeEach(async () => {
  await resetDb()
  mockCreate.mockReset()
  // After a refused call the model gets one more go; by default it just talks.
  mockCreate.mockImplementation(async () => ({
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: 'Press Run.' } }] }
    },
  }))
})

describe('task_complete from the tutor', () => {
  it('records the task, streams task.complete and counts a day of activity', async () => {
    const { user, project } = await setup(DONE)
    complete()

    const events = await drain(await post(project.id, run(DONE, 'Hi Moral\n')))

    expect(events.find((e) => e.type === 'task.complete')?.completedTaskIds).toEqual([
      'first-words',
      'intro-3',
      task.id,
    ])
    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3', task.id])
    expect(
      await db.select().from(activityDays).where(eq(activityDays.userId, user.id))
    ).toHaveLength(1)
  })

  it('keeps an audit row of what the tutor saw and why it said yes', async () => {
    const { project } = await setup(DONE)
    verdict([['task_complete', { taskId: task.id, reason: 'greets with an f-string' }]])
    await drain(await post(project.id, run(DONE, 'Hi Moral\n')))

    const rows = await db.select().from(taskProgress).where(eq(taskProgress.projectId, project.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      taskId: task.id,
      reason: 'greets with an f-string',
      judgedBy: 'tutor',
      code: { 'main.py': DONE },
      output: { 'main.py': 'Hi Moral\n' },
    })
  })

  it('judges the code that just ran, not a stale saved copy', async () => {
    const { project } = await setup(HALF) // saved board is behind the run
    complete()
    await drain(await post(project.id, run(DONE, 'Hi Moral\n')))
    expect(await progressOf(project.id)).toContain(task.id)
  })

  it('refuses when the static requirements are not in the code', async () => {
    const { project } = await setup(HALF)
    complete()
    const events = await drain(await post(project.id, run(HALF, 'Hi\n')))
    expect(events.some((e) => e.type === 'task.complete')).toBe(false)
    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3'])
    expect(await db.select().from(taskProgress)).toHaveLength(0)
  })

  it('refuses "I am done" when the code has never been run', async () => {
    const { project } = await setup(DONE)
    complete()
    await drain(await post(project.id, { type: 'student_message', text: 'I am done, mark it' }))
    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3'])
  })

  it('accepts a message when the page already shows a run of the code', async () => {
    const { project } = await setup(DONE, 'Hi Moral\n')
    complete()
    await drain(await post(project.id, { type: 'student_message', text: 'did it work?' }))
    expect(await progressOf(project.id)).toContain(task.id)
  })

  it('refuses a task that is not the open one', async () => {
    const { project } = await setup(DONE, 'Hi Moral\n')
    complete('shout')
    await drain(await post(project.id, { type: 'student_message', text: 'hi' }))
    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3'])
  })

  it('writes nothing when the tutor does not call it', async () => {
    const { project } = await setup(DONE, 'Hi Moral\n')
    verdict([])
    await drain(await post(project.id, run(DONE, 'Hi Moral\n')))
    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3'])
  })

  it('is idempotent when the tutor calls it twice', async () => {
    const { project } = await setup(DONE)
    verdict([
      ['task_complete', { taskId: task.id, reason: 'a' }],
      ['task_complete', { taskId: task.id, reason: 'b' }],
    ])
    await drain(await post(project.id, run(DONE, 'Hi Moral\n')))
    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3', task.id])
    expect(await db.select().from(taskProgress)).toHaveLength(1)
  })

  it('offers no task_complete while the concept steps are still showing', async () => {
    const { project } = await setup('', undefined, [])
    await db
      .update((await import('@/lib/db/schema')).projects)
      .set({
        board: {
          pages: [{ id: taskPageId(lesson.tasks[0]), title: 'x', nodeIds: [] }],
          activePageId: taskPageId(lesson.tasks[0]),
          focusId: null,
          nodes: {},
        },
      })
      .where(eq((await import('@/lib/db/schema')).projects.id, project.id))
    verdict([])
    await drain(await post(project.id, { type: 'student_message', text: 'hi' }))
    const tools = mockCreate.mock.calls[0][0].tools as { function: { name: string } }[]
    expect(tools.map((t) => t.function.name)).not.toContain('task_complete')
  })
})

describe('an edit after the last run', () => {
  it('is not accepted until the student runs it again', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
    const b = board(DONE, 'Hi Moral\n')
    ;(b.nodes.o1 as Record<string, unknown>).ran = HALF // the output came from older code
    const project = await makeProject(user.id, {
      lessonId: lesson.id,
      lessonVersion: 3,
      files: { 'main.py': DONE },
      board: b,
    })
    await setLessonProgress(project.id, ['first-words', 'intro-3'], new Date().toISOString())
    complete()

    await drain(await post(project.id, { type: 'student_message', text: 'done!' }))

    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3'])
  })
})

describe('a task with two programs', () => {
  const fw = lesson.tasks.find((t) => t.id === 'first-words')!
  const page = taskPageId(fw)
  const two = (secondRan: string | null) => ({
    pages: [
      {
        id: page,
        title: fw.chip,
        nodeIds: ['a', 'oa', 'b', ...(secondRan === null ? [] : ['ob'])],
      },
    ],
    activePageId: page,
    focusId: null,
    nodes: {
      a: {
        id: 'a',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source: 'print("hello Moral")',
        editable: true,
      },
      oa: {
        id: 'oa',
        parentId: null,
        createdBy: 'system',
        type: 'output',
        forNodeId: 'a',
        stdout: 'hello Moral\n',
        stderr: '',
        ok: true,
        ran: 'print("hello Moral")',
      },
      b: {
        id: 'b',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        file: 'line2.py',
        source: 'print("Hi")\nprint("see you")',
        editable: true,
      },
      ...(secondRan === null
        ? {}
        : {
            ob: {
              id: 'ob',
              parentId: null,
              createdBy: 'system',
              type: 'output',
              forNodeId: 'b',
              stdout: secondRan,
              stderr: '',
              ok: true,
              ran: 'print("Hi")\nprint("see you")',
            },
          }),
    },
  })
  const start = async (b: object) => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
    const project = await makeProject(user.id, {
      lessonId: lesson.id,
      lessonVersion: 3,
      files: { 'main.py': 'print("hello Moral")' },
      board: b,
    })
    await setLessonProgress(project.id, [], new Date().toISOString())
    return project
  }

  it('is refused while the second program has never run', async () => {
    const project = await start(two(null))
    complete('first-words')
    await drain(
      await post(project.id, {
        type: 'code_run_result',
        nodeId: 'a',
        source: 'print("hello Moral")',
        ok: true,
        stdout: 'hello Moral\n',
        stderr: '',
      })
    )
    expect(await progressOf(project.id)).toEqual([])
  })

  it('is accepted once both printed new words', async () => {
    const project = await start(two('Hi\nsee you\n'))
    complete('first-words')
    await drain(
      await post(project.id, {
        type: 'code_run_result',
        nodeId: 'b',
        source: 'print("Hi")\nprint("see you")',
        ok: true,
        stdout: 'Hi\nsee you\n',
        stderr: '',
      })
    )
    expect(await progressOf(project.id)).toEqual(['first-words'])
  })

  it('is refused when line 2 still says the starter words', async () => {
    const project = await start(two('Hi\nbye bye\n'))
    complete('first-words')
    await drain(
      await post(project.id, {
        type: 'code_run_result',
        nodeId: 'b',
        source: 'print("Hi")\nprint("bye bye")',
        ok: true,
        stdout: 'Hi\nbye bye\n',
        stderr: '',
      })
    )
    expect(await progressOf(project.id)).toEqual([])
  })
})

describe('a choice task while a later bonus task is still pending', () => {
  // Choice/bonus tasks are never pendingCoreTask's answer, so the turn route
  // must open whichever unlocked one the student's board page names instead.
  const paint = lesson.tasks.find((t) => t.id === 'paint')!
  const CODE = 'import sparky\nsparky.color("pink")\n'
  const paintBoard = {
    pages: [{ id: taskPageId(paint), title: paint.chip, nodeIds: ['c1'] }],
    activePageId: taskPageId(paint),
    focusId: null,
    nodes: {
      c1: {
        id: 'c1',
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source: CODE,
        editable: true,
      },
    },
  }

  it('is recorded even though every core task is done and another bonus task is open', async () => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
    const project = await makeProject(user.id, {
      lessonId: lesson.id,
      lessonVersion: 3,
      files: { 'main.py': CODE },
      board: paintBoard,
    })
    await setLessonProgress(
      project.id,
      ['first-words', 'intro-3', 'name-tag', 'shout', 'boot-up'],
      new Date().toISOString()
    )
    complete(paint.id)

    await drain(
      await post(project.id, {
        type: 'code_run_result',
        nodeId: 'c1',
        source: CODE,
        ok: true,
        stdout: '',
        stderr: '',
      })
    )

    expect(await progressOf(project.id)).toContain(paint.id)
  })
})

describe("Bolt's block is never evidence", () => {
  // Bolt's block holds the finished answer and a run of it; the student's editor was never run.
  const withBolt = () => {
    const b = board(DONE)
    return {
      ...b,
      pages: [{ ...b.pages[0], nodeIds: ['c1', 'bolt_1'] }],
      nodes: {
        ...b.nodes,
        bolt_1: {
          id: 'bolt_1',
          parentId: null,
          createdBy: 'system',
          type: 'helper',
          request: 'greet me',
          source: DONE,
          stdout: 'Hi Moral\n',
          stderr: '',
          ok: true,
        },
      },
    }
  }
  const setupBolt = async () => {
    const { project } = await setup(DONE)
    await db.update(projects).set({ board: withBolt() }).where(eq(projects.id, project.id))
    return project
  }

  it("a run of only Bolt's block does not let task_complete through", async () => {
    const project = await setupBolt()
    complete()
    const events = await drain(await post(project.id, { type: 'student_message', text: 'done!' }))
    expect(events.some((e) => e.type === 'task.complete')).toBe(false)
    // Bolt's run output never reaches Sparky as evidence.
    expect(mockCreate.mock.calls[0][0].messages[0].content).not.toContain('Hi Moral')
    expect(await progressOf(project.id)).toEqual(['first-words', 'intro-3'])
  })

  it("a run reported against Bolt's block is rejected", async () => {
    const project = await setupBolt()
    const res = await post(project.id, { ...run(DONE, 'Hi Moral\n'), nodeId: 'bolt_1' })
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("a run of the student's own editor still completes the task", async () => {
    const project = await setupBolt()
    complete()
    await drain(await post(project.id, run(DONE, 'Hi Moral\n')))
    expect(await progressOf(project.id)).toContain(task.id)
  })
})

// Mission rule 4 in Week 8: code counts only once the student explains it. The static
// floor refuses code without the student's # notes and "# ask:" line, whoever wrote it.
describe('Week 8: notes and the ask are evidence', () => {
  const week8 = LESSONS.find((l) => l.id === 108)!
  const makePet = week8.tasks.find((t) => t.id === 'make-pet')!
  const PASTED = 'print("I am Rex")\nprint("Woof!")\n'
  const NOTED = 'print("I am Rex")  # Rex says his name\nprint("Woof!")  # then he barks\n'
  const ASKED = `# ask: a pet named Rex that says Woof\n${NOTED}`

  const attempt = async (source: string) => {
    const user = await makeUser()
    mockGetSessionUser.mockResolvedValue({ id: user.id, email: user.email, name: 'Mia' })
    const b = board(source)
    const project = await makeProject(user.id, {
      lessonId: week8.id,
      lessonVersion: 3,
      files: { 'main.py': source },
      board: { ...b, pages: [{ ...b.pages[0], id: taskPageId(makePet), title: makePet.chip }] },
    })
    await setLessonProgress(project.id, [], new Date().toISOString())
    complete(makePet.id)
    const events = await drain(await post(project.id, run(source, 'I am Rex\nWoof!\n')))
    // A refusal goes back to the model as the tool result it sees on its retry.
    const retry = JSON.stringify(mockCreate.mock.calls[1]?.[0].messages ?? [])
    return { events, retry, progress: await progressOf(project.id) }
  }

  it('refuses pasted code that passes the behaviour checks but has no notes', async () => {
    const { events, retry, progress } = await attempt(PASTED)
    expect(events.some((e) => e.type === 'task.complete')).toBe(false)
    expect(retry).toContain('not finished: Write # ask: then your words.')
    expect(progress).toEqual([])
  })

  it('refuses the same code with notes but no # ask: line', async () => {
    const { events, retry, progress } = await attempt(NOTED)
    expect(events.some((e) => e.type === 'task.complete')).toBe(false)
    expect(retry).toContain('not finished: Write # ask: then your words.')
    expect(progress).toEqual([])
  })

  it('refuses notes that only repeat the code', async () => {
    const echo = 'print("I am Rex")  # print I am Rex\nprint("Woof!")  # prints Woof\n'
    const { events, retry } = await attempt(`# ask: a pet named Rex that says Woof\n${echo}`)
    expect(events.some((e) => e.type === 'task.complete')).toBe(false)
    expect(retry).toContain('not finished: After a line: # and your words.')
  })

  it('refuses an ask with no notes', async () => {
    const { events, retry } = await attempt(`# ask: a pet named Rex that says Woof\n${PASTED}`)
    expect(events.some((e) => e.type === 'task.complete')).toBe(false)
    expect(retry).toContain('not finished: After a line: # and your words.')
  })

  it('completes with both the notes and the ask', async () => {
    const { events, progress } = await attempt(ASKED)
    expect(events.some((e) => e.type === 'task.complete')).toBe(true)
    expect(progress).toEqual([makePet.id])
  })
})
