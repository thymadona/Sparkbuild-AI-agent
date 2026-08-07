import {
  getUserRoles,
  hasPermission,
  isAdmin,
  requirePermission,
  isTeacherOfClass,
  getTeacherClassIds,
  ForbiddenError,
} from '@/lib/auth/permissions'

const mockRpc = jest.fn()
const mockFrom = jest.fn()
jest.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const USER_ID = 'user-123'
const CLASS_ID = 'class-456'

// Supabase's query builder is itself awaitable (thenable) — select()/eq()
// return `this`, and awaiting the chain resolves to the query result.
function makeFromChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = jest.fn(() => chain)
  chain.eq = jest.fn(() => chain)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('hasPermission', () => {
  it('returns true when the RPC reports the permission is granted', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await expect(hasPermission(USER_ID, 'invoices:manage')).resolves.toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('has_permission', { p_user_id: USER_ID, p_key: 'invoices:manage' })
  })

  it('returns false when the RPC reports the permission is denied', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    await expect(hasPermission(USER_ID, 'invoices:manage')).resolves.toBe(false)
  })

  it('fails closed (denies) when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })
    await expect(hasPermission(USER_ID, 'invoices:manage')).resolves.toBe(false)
  })
})

describe('isAdmin', () => {
  it('returns true for an admin user', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await expect(isAdmin(USER_ID)).resolves.toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('is_admin', { p_user_id: USER_ID })
  })

  it('fails closed (denies) when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })
    await expect(isAdmin(USER_ID)).resolves.toBe(false)
  })
})

describe('requirePermission', () => {
  it('resolves when the permission is granted', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await expect(requirePermission(USER_ID, 'classes:manage')).resolves.toBeUndefined()
  })

  it('rejects with ForbiddenError when the permission is denied', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    await expect(requirePermission(USER_ID, 'classes:manage')).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('rejects with ForbiddenError (fail closed) when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })
    await expect(requirePermission(USER_ID, 'classes:manage')).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('isTeacherOfClass', () => {
  it('returns true when the RPC confirms teacher access', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await expect(isTeacherOfClass(USER_ID, CLASS_ID)).resolves.toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('is_teacher_of_class', { p_user_id: USER_ID, p_class_id: CLASS_ID })
  })

  it('fails closed (denies) when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })
    await expect(isTeacherOfClass(USER_ID, CLASS_ID)).resolves.toBe(false)
  })
})

describe('getUserRoles', () => {
  it('maps joined role rows to role names', async () => {
    mockFrom.mockReturnValue(
      makeFromChain({ data: [{ roles: { name: 'admin' } }, { roles: { name: 'teacher' } }], error: null })
    )
    await expect(getUserRoles(USER_ID)).resolves.toEqual(['admin', 'teacher'])
  })

  it('throws (does not fail open) when the query errors', async () => {
    mockFrom.mockReturnValue(makeFromChain({ data: null, error: { message: 'DB unavailable' } }))
    await expect(getUserRoles(USER_ID)).rejects.toBeTruthy()
  })
})

describe('getTeacherClassIds', () => {
  it('maps rows to class ids', async () => {
    mockFrom.mockReturnValue(makeFromChain({ data: [{ class_id: 'a' }, { class_id: 'b' }], error: null }))
    await expect(getTeacherClassIds(USER_ID)).resolves.toEqual(['a', 'b'])
  })

  it('throws (does not fail open) when the query errors', async () => {
    mockFrom.mockReturnValue(makeFromChain({ data: null, error: { message: 'DB unavailable' } }))
    await expect(getTeacherClassIds(USER_ID)).rejects.toBeTruthy()
  })
})
