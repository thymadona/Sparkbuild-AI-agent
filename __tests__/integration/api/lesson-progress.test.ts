const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  getSessionUser: () => mockGetSessionUser(),
}))

jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { GET, PUT } from '@/app/api/projects/[id]/lesson-progress/route'
import { makeProject, makeUser, resetDb } from '@/__tests__/helpers/db'

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
  // Asserted against lib/db/schema.ts rather than a migration file: the
  // schema is the authoring entry point, so that is where someone would
  // break this. (This used to read drizzle/0006_lesson_progress.sql, which
  // moved to drizzle/_archive/ when the history was squashed to
  // 0000_baseline.sql.)
  it('uses a cascading project foreign key so progress is removed with its project', () => {
    const schema = require('fs').readFileSync('lib/db/schema.ts', 'utf8')
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
    mockGetSessionUser.mockResolvedValue(owner)

    await PUT(request({ completedTaskIds: ['identity'] }), props(project.id))

    const res = await GET(new Request('http://localhost'), props(project.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ completedTaskIds: ['identity'] })
  })

  it('rejects task IDs that do not belong to the lesson', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await PUT(request({ completedTaskIds: ['not-a-task'] }), props(project.id))
    expect(res.status).toBe(400)
  })

  it('stores unique valid task IDs for the owner', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await PUT(request({ completedTaskIds: ['identity', 'identity'] }), props(project.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ completedTaskIds: ['identity'] })
  })

  it('upserts rather than duplicating when progress is saved twice', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(owner)

    await PUT(request({ completedTaskIds: ['identity'] }), props(project.id))
    const res = await PUT(request({ completedTaskIds: ['identity', 'interests'] }), props(project.id))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ completedTaskIds: ['identity', 'interests'] })
  })

  it('returns 404 rather than exposing another student’s project', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(intruder)

    const res = await PUT(request({ completedTaskIds: [] }), props(project.id))
    expect(res.status).toBe(404)
  })

  it('does not write another student’s progress', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id)

    mockGetSessionUser.mockResolvedValue(owner)
    await PUT(request({ completedTaskIds: ['identity'] }), props(project.id))

    mockGetSessionUser.mockResolvedValue(intruder)
    await PUT(request({ completedTaskIds: ['identity', 'interests'] }), props(project.id))

    mockGetSessionUser.mockResolvedValue(owner)
    const res = await GET(new Request('http://localhost'), props(project.id))
    expect(await res.json()).toEqual({ completedTaskIds: ['identity'] })
  })
})
