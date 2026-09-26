/**
 * getSessionUser pauses a suspended org's members: every API route starts
 * with it, so returning null here is what makes them all refuse. Better
 * Auth's session lookup is mocked; the suspension check hits the real DB.
 */
const mockGetSession = jest.fn()

jest.mock('next/headers', () => ({ headers: async () => new Headers() }))
jest.mock('@/lib/auth', () => ({ auth: { api: { getSession: () => mockGetSession() } } }))

import { eq } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { organizations } from '@/lib/db/schema'
import { makeOrg, makeUser, resetDb } from '@/__tests__/helpers/db'

beforeEach(resetDb)
afterAll(() => db.$client.end())

type User = Awaited<ReturnType<typeof makeUser>>
const sessionOf = (u: User) =>
  mockGetSession.mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, orgId: u.orgId },
  })

describe('getSessionUser and suspension', () => {
  it('returns a Direct user', async () => {
    const user = await makeUser()
    sessionOf(user)
    await expect(getSessionUser()).resolves.toMatchObject({ id: user.id, orgId: user.orgId })
  })

  it('returns null for a member of a suspended school, and the user again once restored', async () => {
    const school = await makeOrg()
    const user = await makeUser({ orgId: school.id })
    sessionOf(user)
    await db
      .update(organizations)
      .set({ status: 'suspended' })
      .where(eq(organizations.id, school.id))
    await expect(getSessionUser()).resolves.toBeNull()

    await db.update(organizations).set({ status: 'active' }).where(eq(organizations.id, school.id))
    await expect(getSessionUser()).resolves.toMatchObject({ id: user.id })
  })

  it('fails closed for a school user when the check errors', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'not-a-uuid', email: '', name: '', orgId: 'not-a-uuid' },
    })
    await expect(getSessionUser()).resolves.toBeNull()
  })
})
