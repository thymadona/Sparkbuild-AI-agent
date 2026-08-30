/**
 * Integration tests for the /api/projects route handlers.
 *
 * These run against the real TEST_DATABASE_URL rather than a mocked PostgREST
 * chain. The rules worth testing here — ownership on update and delete, and
 * which child rows a delete is allowed to touch — are `where` predicates now,
 * and a mock that replays whatever it was handed cannot assert any of them.
 */

const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  getSessionUser: () => mockGetSessionUser(),
}))

// next/headers is imported transitively; mock it to avoid Next.js runtime errors
jest.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: jest.fn() }),
}))

import { eq } from 'drizzle-orm'
import { GET, POST, PATCH, DELETE } from '@/app/api/projects/route'
import { db } from '@/lib/db/client'
import { messages, projects, prompts } from '@/lib/db/schema'
import { makeProject, makeUser, resetDb } from '@/__tests__/helpers/db'

function makeRequest(method: string, body?: object, url = 'http://localhost/api/projects') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const deleteRequest = (id: string) =>
  makeRequest('DELETE', undefined, `http://localhost/api/projects?id=${id}`)

beforeEach(async () => {
  jest.clearAllMocks()
  await resetDb()
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe('GET /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('returns only the authenticated user’s projects, newest first', async () => {
    const owner = await makeUser()
    const other = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)

    await makeProject(owner.id, { title: 'Older', updatedAt: '2026-01-01T00:00:00Z' })
    await makeProject(owner.id, { title: 'Newer', updatedAt: '2026-06-01T00:00:00Z' })
    await makeProject(other.id, { title: 'Not mine' })

    const res = await GET()
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.map((p: { title: string }) => p.title)).toEqual(['Newer', 'Older'])
  })
})

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe('POST /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    expect((await POST(makeRequest('POST', { title: 'Test' }))).status).toBe(401)
  })

  it('creates a project and returns 201 with the new project', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await POST(makeRequest('POST', { title: 'My App' }))
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.title).toBe('My App')
    expect(json.user_id).toBe(owner.id)
    expect(json.is_public).toBe(false)

    const [row] = await db.select().from(projects).where(eq(projects.id, json.id))
    expect(row.userId).toBe(owner.id)
  })

  it('generates a random two-word title when none is provided', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(201)

    // The route picks an "<Adjective> <Noun>" name rather than a fixed
    // placeholder, so that a dashboard of new projects is scannable.
    const json = await res.json()
    expect(json.title).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
  })

  it('returns the snake_case shape the client components expect', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)

    const json = await (await POST(makeRequest('POST', { title: 'Shape' }))).json()
    expect(Object.keys(json).sort()).toEqual(
      [
        'created_at',
        'files',
        'id',
        'is_public',
        'lesson_id',
        'lesson_version',
        'submission_status',
        'title',
        'updated_at',
        'user_id',
      ].sort()
    )
  })
})

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
describe('PATCH /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    expect((await PATCH(makeRequest('PATCH', { id: 'p1', title: 'New' }))).status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    expect((await PATCH(makeRequest('PATCH', { title: 'New' }))).status).toBe(400)
  })

  it('returns 404 for an id that is not a uuid', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    const res = await PATCH(makeRequest('PATCH', { id: 'p1', title: 'New' }))
    expect(res.status).toBe(404)
  })

  it('returns 404 and changes nothing when the project belongs to someone else', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id, { title: 'Original' })
    mockGetSessionUser.mockResolvedValue(intruder)

    const res = await PATCH(makeRequest('PATCH', { id: project.id, title: 'Hijacked' }))
    expect(res.status).toBe(404)

    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    expect(row.title).toBe('Original')
  })

  it('updates and returns the project for the owner', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id, { title: 'Old Title' })
    mockGetSessionUser.mockResolvedValue(owner)

    const res = await PATCH(
      makeRequest('PATCH', { id: project.id, title: 'New Title', is_public: true })
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.title).toBe('New Title')
    expect(json.is_public).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    expect((await DELETE(deleteRequest('p1'))).status).toBe(401)
  })

  it('returns 400 when id query param is missing', async () => {
    const owner = await makeUser()
    mockGetSessionUser.mockResolvedValue(owner)
    expect((await DELETE(makeRequest('DELETE', undefined, 'http://localhost/api/projects'))).status).toBe(400)
  })

  it('returns 404 when project belongs to a different user', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id)
    mockGetSessionUser.mockResolvedValue(intruder)

    expect((await DELETE(deleteRequest(project.id))).status).toBe(404)

    const rows = await db.select().from(projects).where(eq(projects.id, project.id))
    expect(rows).toHaveLength(1)
  })

  // The handler used to clear messages and prompts by project_id before it
  // checked ownership, so passing someone else's id wiped their chat history
  // and prompt log while leaving the project itself intact.
  it('does not delete another user’s messages or prompts', async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const project = await makeProject(owner.id)

    await db.insert(messages).values({
      projectId: project.id,
      userId: owner.id,
      role: 'user',
      content: 'hello',
    })
    await db.insert(prompts).values({
      projectId: project.id,
      userId: owner.id,
      content: 'make it blue',
    })

    mockGetSessionUser.mockResolvedValue(intruder)
    expect((await DELETE(deleteRequest(project.id))).status).toBe(404)

    expect(await db.select().from(messages).where(eq(messages.projectId, project.id))).toHaveLength(1)
    expect(await db.select().from(prompts).where(eq(prompts.projectId, project.id))).toHaveLength(1)
  })

  it('deletes the project and its child rows for the owner', async () => {
    const owner = await makeUser()
    const project = await makeProject(owner.id)

    await db.insert(messages).values({
      projectId: project.id,
      userId: owner.id,
      role: 'user',
      content: 'hello',
    })
    await db.insert(prompts).values({
      projectId: project.id,
      userId: owner.id,
      content: 'make it blue',
    })

    mockGetSessionUser.mockResolvedValue(owner)
    const res = await DELETE(deleteRequest(project.id))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)

    expect(await db.select().from(projects).where(eq(projects.id, project.id))).toHaveLength(0)
    expect(await db.select().from(messages).where(eq(messages.projectId, project.id))).toHaveLength(0)
    expect(await db.select().from(prompts).where(eq(prompts.projectId, project.id))).toHaveLength(0)
  })
})
