const mockGetUser = jest.fn()
const mockAdminFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({ auth: { getUser: mockGetUser } }),
  supabaseAdmin: { from: (...args: unknown[]) => mockAdminFrom(...args) },
}))

jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: jest.fn() }) }))

import { GET, PUT } from '@/app/api/projects/[id]/lesson-progress/route'

const user = { id: 'student-1' }
const params = { params: Promise.resolve({ id: 'project-1' }) }

function request(body?: unknown) {
  return new Request('http://localhost/api/projects/project-1/lesson-progress', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function projectChain(project: unknown) {
  const chain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: project })
  return chain
}

function progressReadChain(progress: unknown) {
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue({ data: progress, error: null })
  return chain
}

function progressWriteChain() {
  const chain = { upsert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.upsert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: { completed_task_ids: ['identity'] }, error: null })
  return chain
}

beforeEach(() => jest.clearAllMocks())

describe('lesson progress API', () => {
  it('uses a cascading project foreign key so progress is removed with its project', () => {
    const migration = require('fs').readFileSync('supabase/migrations/20260727_lesson_progress.sql', 'utf8')
    expect(migration).toMatch(/project_id uuid primary key references projects\(id\) on delete cascade/i)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect((await GET(new Request('http://localhost'), params)).status).toBe(401)
  })

  it('loads progress only after confirming the project belongs to the student', async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    const project = projectChain({ id: 'project-1', lesson_id: 1, lesson_version: 2 })
    const progress = progressReadChain({ completed_task_ids: ['identity'] })
    mockAdminFrom.mockImplementation((table: string) => table === 'projects' ? project : progress)

    const response = await GET(new Request('http://localhost'), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ completedTaskIds: ['identity'] })
    expect(project.eq).toHaveBeenCalledWith('user_id', user.id)
  })

  it('rejects task IDs that do not belong to the lesson', async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockAdminFrom.mockReturnValue(projectChain({ id: 'project-1', lesson_id: 1, lesson_version: 2 }))

    const response = await PUT(request({ completedTaskIds: ['not-a-task'] }), params)
    expect(response.status).toBe(400)
  })

  it('stores unique valid task IDs for the owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    const project = projectChain({ id: 'project-1', lesson_id: 1, lesson_version: 2 })
    const progress = progressWriteChain()
    mockAdminFrom.mockImplementation((table: string) => table === 'projects' ? project : progress)

    const response = await PUT(request({ completedTaskIds: ['identity', 'identity'] }), params)
    expect(response.status).toBe(200)
    expect(progress.upsert).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'project-1', completed_task_ids: ['identity'] }))
  })

  it('returns 404 rather than exposing another student’s project', async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockAdminFrom.mockReturnValue(projectChain(null))

    expect((await PUT(request({ completedTaskIds: [] }), params)).status).toBe(404)
  })
})
