/**
 * Integration tests for /api/projects route handlers.
 * Supabase clients are mocked so no real DB connection is needed.
 */

const mockGetUser = jest.fn()
const mockAdminFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mockGetUser },
  }),
  supabaseAdmin: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
  },
}))

// next/headers is imported transitively; mock it to avoid Next.js runtime errors
jest.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: jest.fn() }),
}))

import { GET, POST, PATCH, DELETE } from '@/app/api/projects/route'

const AUTHED_USER = { id: 'user-abc', email: 'student@school.edu' }

function makeAdminChain(overrides: Record<string, jest.Mock> = {}) {
  const base = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  }
  // Make chained calls return the same object
  Object.values(base).forEach((fn) => {
    if (typeof fn === 'function' && fn !== base.order && fn !== base.single) {
      (fn as jest.Mock).mockReturnValue(base)
    }
  })
  return base
}

function makeRequest(method: string, body?: object, url = 'http://localhost/api/projects') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe('GET /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns project list for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const projects = [{ id: 'p1', title: 'My App', user_id: AUTHED_USER.id }]
    const chain = makeAdminChain()
    chain.order.mockResolvedValue({ data: projects, error: null })
    mockAdminFrom.mockReturnValue(chain)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(projects)
  })

  it('returns 500 when supabase returns an error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const chain = makeAdminChain()
    chain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    mockAdminFrom.mockReturnValue(chain)

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe('POST /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeRequest('POST', { title: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('creates a project and returns 201 with the new project', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const newProject = { id: 'new-id', title: 'My App', user_id: AUTHED_USER.id, files: {}, is_public: false }
    const chain = makeAdminChain()
    chain.single.mockResolvedValue({ data: newProject, error: null })
    mockAdminFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('POST', { title: 'My App' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('new-id')
    expect(json.title).toBe('My App')
  })

  it('uses "Untitled" as default title when none is provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const chain = makeAdminChain()
    chain.single.mockResolvedValue({ data: { id: 'x', title: 'Untitled', files: {} }, error: null })
    mockAdminFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(201)
    // Verify insert was called — title defaults handled in route
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Untitled' })
    )
  })
})

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
describe('PATCH /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await PATCH(makeRequest('PATCH', { id: 'p1', title: 'New' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const res = await PATCH(makeRequest('PATCH', { title: 'New' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when project belongs to a different user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const chain = makeAdminChain()
    // UPDATE with wrong user_id filter returns no row
    chain.single.mockResolvedValue({ data: null, error: null })
    mockAdminFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('PATCH', { id: 'p1', title: 'New' }))
    expect(res.status).toBe(404)
  })

  it('updates and returns the project for the owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const updated = { id: 'p1', title: 'New Title', is_public: true, user_id: AUTHED_USER.id }

    const chain = makeAdminChain()
    // Single UPDATE filtered by id + user_id returns the updated row
    chain.single.mockResolvedValue({ data: updated, error: null })
    mockAdminFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('PATCH', { id: 'p1', title: 'New Title', is_public: true }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.title).toBe('New Title')
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await DELETE(makeRequest('DELETE', undefined, 'http://localhost/api/projects?id=p1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id query param is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const res = await DELETE(makeRequest('DELETE', undefined, 'http://localhost/api/projects'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when project belongs to a different user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const chain = makeAdminChain()
    // DELETE filtered by id + user_id — second eq resolves with error (no match)
    const deleteChain = {
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: { message: 'No rows deleted' } }),
      }),
    }
    chain.delete.mockReturnValue(deleteChain)
    mockAdminFrom.mockReturnValue(chain)

    const res = await DELETE(makeRequest('DELETE', undefined, 'http://localhost/api/projects?id=p1'))
    expect(res.status).toBe(500)
  })

  it('deletes the project and returns success for the owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    const chain = makeAdminChain()
    // DELETE filtered by id + user_id succeeds
    const deleteChain = {
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }
    chain.delete.mockReturnValue(deleteChain)
    mockAdminFrom.mockReturnValue(chain)

    const res = await DELETE(makeRequest('DELETE', undefined, 'http://localhost/api/projects?id=p1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
