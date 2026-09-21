const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  getSessionUser: () => mockGetSessionUser(),
}))

jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { GET, PUT } from '@/app/api/projects/[id]/lesson-progress/route'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activityDays } from '@/lib/db/schema'
import { makeProject, makeUser, resetDb, setLessonProgress } from '@/__tests__/helpers/db'

// Real rows in a real database rather than a mocked PostgREST chain. The
// ownership rule this route enforces is a `where` predicate now, so a mock
// that returns whatever it was told would assert nothing about it.
function request(body?: unknown) {
  return new Request('http://localhost/api/projects/x/lesson-progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const props = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(async () => {
  jest.clearAllMocks()
  await resetDb()
})

describe('lesson progress API', () => {
  // Asserted against lib/db/schemas/lesson-progress.ts rather than a migration file: the
  // schema is the authoring entry point, so that is where someone would
  // break this. (This used to read drizzle/0006_lesson_progress.sql, which
  // moved to drizzle/_archive/ when the history was squashed to
  // 0000_baseline.sql.)
  it('uses a cascading project foreign key so progress is removed with its project', () => {
    const schema = require('fs').readFileSync('lib/db/schemas/lesson-progress.ts', 'utf8')
    expect(schema).toMatch(
      /projectId: uuid\('project_id'\)\.primaryKey\(\)\.references\(\(\) => projects\.id, \{ onDelete: 'cascade' \}\)/
    )
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), props('project-1'))
    expect(res.status).toBe(401)
  })

  // A bad id used to reach PostgREST and come back as `{ data: null }`.
  // Postgres raises 22P02 instead, so the route guards the param itself —
  // this asserts a mistyped URL is still a 404 rather than a 500.
  it('returns 404 for an id that is not a uuid', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await GET(new Request('http://localhost'), props('project-1'))
    expect(res.status).toBe(404)
  })

  it('loads progress only after confirming the project belongs to the student', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    await setLessonProgress(project.id, ['first-words'], new Date().toISOString())
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await GET(new Request('http://localhost'), props(project.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ completedTaskIds: ['first-words'] })
  })

  it('rejects task IDs that do not belong to the lesson', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await PUT(request({ completedTaskIds: ['not-a-task'] }), props(project.id))
    expect(res.status).toBe(400)
  })

  // This route may only clear or shrink progress. Finishing a task means
  // proving it is finished, which only the complete/ sibling can judge — if a
  // plain PUT could still add an id, that verification would be decorative.
  it('refuses to add a task, however valid the id', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await PUT(request({ completedTaskIds: ['first-words'] }), props(project.id))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/complete endpoint/i)

    const after = await GET(new Request('http://localhost'), props(project.id))
    expect(await after.json()).toEqual({ completedTaskIds: [] })
  })

  it('clears progress, and drops tasks without adding any', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    await setLessonProgress(project.id, ['first-words', 'name-tag'], new Date().toISOString())
    mockGetSessionUser.mockResolvedValue(owner)

    const shrunk = await PUT(request({ completedTaskIds: ['first-words', 'first-words'] }), props(project.id))
    expect(shrunk.status).toBe(200)
    expect(await shrunk.json()).toEqual({ completedTaskIds: ['first-words'] })

    const reset = await PUT(request({ completedTaskIds: [] }), props(project.id))
    expect(reset.status).toBe(200)
    expect(await reset.json()).toEqual({ completedTaskIds: [] })
  })

  it('returns 404 rather than exposing another student’s project', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(intruder)

    const res = await PUT(request({ completedTaskIds: [] }), props(project.id))
    expect(res.status).toBe(404)
  })

  it('does not clear another student’s progress', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id)
    await setLessonProgress(project.id, ['first-words'], new Date().toISOString())

    mockGetSessionUser.mockResolvedValue(intruder)
    expect((await PUT(request({ completedTaskIds: [] }), props(project.id))).status).toBe(404)

    mockGetSessionUser.mockResolvedValue(owner)
    const res = await GET(new Request('http://localhost'), props(project.id))
    expect(await res.json()).toEqual({ completedTaskIds: ['first-words'] })
  })

  // The streak is credit for doing work. Clearing progress is not work, and
  // this route can no longer do anything else, so it never records a day —
  // finishing a task does, in the complete/ sibling.
  it('never records a day of activity, even for the owner', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    await setLessonProgress(project.id, ['first-words'], new Date().toISOString())
    mockGetSessionUser.mockResolvedValue(owner)

    await PUT(request({ completedTaskIds: [] }), props(project.id))
    expect(await db.select().from(activityDays).where(eq(activityDays.userId, owner.id))).toHaveLength(0)
  })
})
