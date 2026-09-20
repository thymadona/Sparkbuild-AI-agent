const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))
jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { eq } from 'drizzle-orm'
import { POST } from '@/app/api/projects/[id]/lesson-progress/complete/route'
import { db } from '@/lib/db/client'
import { activityDays, lessonProgress } from '@/lib/db/schema'
import { todayISO } from '@/lib/xp'
import { LESSONS } from '@/lib/lessons'
import { makeProject, makeUser, resetDb, setLessonProgress } from '@/__tests__/helpers/db'

// Week 1 of the Python course. Task `name-tag` has two static checks the
// server judges itself plus one runtime check ("it runs") that only the
// browser can report — so a verdict for it rides along with each request.
const lesson = LESSONS[0]
const TASK = 'name-tag'
const RUNS = [undefined, undefined, true]

// Satisfies `name-tag`: a name variable and an f-string greeting.
const DONE = 'name = "Moral"\nprint(f"Hi {name}")\n'
// The variable is there but Sparky still greets without an f-string.
const HALF = 'name = "Moral"\nprint("Hi")\n'

// `first-words` comes before `name-tag`, so every project starts past it.
const makeReady = async (ownerId: string, code: string) => {
  const project = await makeProject(ownerId, { files: { 'main.py': code } })
  await setLessonProgress(project.id, ['first-words'], new Date().toISOString())
  return project
}

const post = (id: string, body: unknown) =>
  POST(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  })

const progressOf = async (projectId: string) => {
  const [row] = await db.select({ ids: lessonProgress.completedTaskIds }).from(lessonProgress).where(eq(lessonProgress.projectId, projectId))
  return row?.ids ?? []
}

beforeEach(async () => {
  jest.clearAllMocks()
  await resetDb()
})

describe('POST /api/projects/[id]/lesson-progress/complete', () => {
  it('refuses a task the stored code does not finish, and says which part', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeReady(owner.id, HALF)

    const res = await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })

    expect(res.status).toBe(409)
    expect((await res.json()).check).toBe('You greet with an f-string')
    expect(await progressOf(project.id)).toEqual(['first-words'])
  })

  it('refuses when the browser has not reported a runtime check passing', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeReady(owner.id, DONE)

    const res = await post(project.id, { taskId: TASK })

    expect(res.status).toBe(409)
    expect((await res.json()).check).toBe('It runs without errors')
  })

  it('records the task once the stored code really finishes it', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeReady(owner.id, DONE)

    const res = await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ completedTaskIds: ['first-words', TASK] })
    expect(await progressOf(project.id)).toEqual(['first-words', TASK])
  })

  // The point of the endpoint: what the browser believes is not evidence.
  it('ignores a client claiming a static check passed', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeReady(owner.id, HALF)

    const res = await post(project.id, { taskId: TASK, runtimeVerdicts: [true, true, true] })

    expect(res.status).toBe(409)
    expect(await progressOf(project.id)).toEqual(['first-words'])
  })

  it('keeps the lesson in order', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    // `shout` is the core task after `name-tag`.
    const project = await makeReady(owner.id, DONE)

    const res = await post(project.id, { taskId: 'shout', runtimeVerdicts: [undefined, true] })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/before this one/i)
  })

  it('holds homework back until every core task is done', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeProject(owner.id, { files: { 'main.py': DONE } })
    const core = lesson.tasks.filter((t) => t.type === 'core').map((t) => t.id)
    await setLessonProgress(project.id, core.slice(0, -1), new Date().toISOString())

    expect((await post(project.id, { taskId: 'hw-add-fact' })).status).toBe(409)
  })

  it('is idempotent, so a retry after a dropped reply is harmless', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeReady(owner.id, DONE)

    await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })
    const again = await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })

    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ completedTaskIds: ['first-words', TASK], alreadyDone: true })
    expect(await progressOf(project.id)).toEqual(['first-words', TASK])
  })

  it('rejects an unknown task and a signed-out or foreign caller', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeReady(owner.id, DONE)

    mockGetSessionUser.mockResolvedValue(owner)
    expect((await post(project.id, { taskId: 'not-a-task' })).status).toBe(400)

    mockGetSessionUser.mockResolvedValue(null)
    expect((await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })).status).toBe(401)

    mockGetSessionUser.mockResolvedValue(intruder)
    expect((await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })).status).toBe(404)
    expect(await progressOf(project.id)).toEqual(['first-words'])
  })

  it('records one day of activity for the streak', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeReady(owner.id, DONE)

    await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })
    await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })

    const days = await db.select().from(activityDays).where(eq(activityDays.userId, owner.id))
    expect(days).toHaveLength(1)
    expect(days[0].day).toBe(todayISO())
  })

  it('records nothing for a refused task', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeReady(owner.id, HALF)

    await post(project.id, { taskId: TASK, runtimeVerdicts: RUNS })
    expect(await db.select().from(activityDays)).toHaveLength(0)
  })
})
