const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))
jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { eq } from 'drizzle-orm'
import { POST } from '@/app/api/projects/[id]/lesson-progress/complete/route'
import { db } from '@/lib/db/client'
import { activityDays, lessonProgress } from '@/lib/db/schema'
import { todayISO } from '@/lib/xp'
import { HTML_LESSONS } from '@/lib/lessons'
import { makeProject, makeUser, resetDb, setLessonProgress } from '@/__tests__/helpers/db'

// Lesson 1 of the HTML course: every check is static, so the server can judge
// the whole task on its own — no Python, no client verdicts.
const lesson = HTML_LESSONS[0]

// Satisfies task `identity`: the h1 and .lead both differ from the starter.
const DONE = '<h1>Hey, I am Moral.</h1><p class="lead">I like football and code.</p>'
// The h1 is edited but the intro is still the template's.
const HALF = '<h1>Hey, I am Moral.</h1><p class="lead">I’m a curious creator who loves turning big ideas into small, colorful experiments.</p>'

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
    const project = await makeProject(owner.id, { files: { 'index.html': HALF } })

    const res = await post(project.id, { taskId: 'identity' })

    expect(res.status).toBe(409)
    expect((await res.json()).check).toBe('You wrote your own intro')
    expect(await progressOf(project.id)).toEqual([])
  })

  it('records the task once the stored code really finishes it', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeProject(owner.id, { files: { 'index.html': DONE } })

    const res = await post(project.id, { taskId: 'identity' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ completedTaskIds: ['identity'] })
    expect(await progressOf(project.id)).toEqual(['identity'])
  })

  // The point of the endpoint: what the browser believes is not evidence.
  it('ignores a client claiming a static check passed', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeProject(owner.id, { files: { 'index.html': HALF } })

    const res = await post(project.id, { taskId: 'identity', runtimeVerdicts: [true, true, true] })

    expect(res.status).toBe(409)
    expect(await progressOf(project.id)).toEqual([])
  })

  it('keeps the lesson in order', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    // `palette` is two core tasks ahead, and its own checks would pass here.
    const project = await makeProject(owner.id, { files: { 'index.html': DONE } })

    const res = await post(project.id, { taskId: 'palette' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/before this one/i)
  })

  it('holds homework back until every core task is done', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeProject(owner.id, { files: { 'index.html': DONE } })
    const core = lesson.tasks.filter((t) => t.type === 'core').map((t) => t.id)
    await setLessonProgress(project.id, core.slice(0, -1), new Date().toISOString())

    expect((await post(project.id, { taskId: 'hw-avatar' })).status).toBe(409)
  })

  it('is idempotent, so a retry after a dropped reply is harmless', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeProject(owner.id, { files: { 'index.html': DONE } })

    await post(project.id, { taskId: 'identity' })
    const again = await post(project.id, { taskId: 'identity' })

    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ completedTaskIds: ['identity'], alreadyDone: true })
    expect(await progressOf(project.id)).toEqual(['identity'])
  })

  it('rejects an unknown task and a signed-out or foreign caller', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id, { files: { 'index.html': DONE } })

    mockGetSessionUser.mockResolvedValue(owner)
    expect((await post(project.id, { taskId: 'not-a-task' })).status).toBe(400)

    mockGetSessionUser.mockResolvedValue(null)
    expect((await post(project.id, { taskId: 'identity' })).status).toBe(401)

    mockGetSessionUser.mockResolvedValue(intruder)
    expect((await post(project.id, { taskId: 'identity' })).status).toBe(404)
    expect(await progressOf(project.id)).toEqual([])
  })

  it('records one day of activity for the streak', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeProject(owner.id, { files: { 'index.html': DONE } })

    await post(project.id, { taskId: 'identity' })
    await post(project.id, { taskId: 'identity' })

    const days = await db.select().from(activityDays).where(eq(activityDays.userId, owner.id))
    expect(days).toHaveLength(1)
    expect(days[0].day).toBe(todayISO())
  })

  it('records nothing for a refused task', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const project = await makeProject(owner.id, { files: { 'index.html': HALF } })

    await post(project.id, { taskId: 'identity' })
    expect(await db.select().from(activityDays)).toHaveLength(0)
  })
})
