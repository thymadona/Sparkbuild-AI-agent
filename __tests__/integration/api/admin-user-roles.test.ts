/**
 * /api/admin/users/[id]/roles: the session is mocked; permissions and the
 * database are real, so the org checks are the ones production runs.
 */
const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))

import { and, eq } from 'drizzle-orm'
import { DELETE, POST } from '@/app/api/admin/users/[id]/roles/route'
import { db } from '@/lib/db/client'
import { roles, userRoles } from '@/lib/db/schema'
import { grantRole, makeOrg, makeUser, resetDb } from '@/__tests__/helpers/db'

beforeEach(async () => {
  await resetDb()
  mockGetSessionUser.mockReset()
})
afterAll(() => db.$client.end())

type User = Awaited<ReturnType<typeof makeUser>>

function signIn(user: User) {
  mockGetSessionUser.mockResolvedValue({ id: user.id, orgId: user.orgId })
}

const grant = (id: string, role: string) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ role }) }), {
    params: Promise.resolve({ id }),
  })

const revoke = (id: string, role: string) =>
  DELETE(new Request(`http://x?role=${role}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id }),
  })

async function grantsOf(userId: string, role: string) {
  return db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(roles.name, role)))
}

async function directAdmin() {
  const admin = await makeUser()
  await grantRole(admin.id, 'admin')
  signIn(admin)
  return admin
}

describe('POST/DELETE /api/admin/users/[id]/roles', () => {
  it("grants and revokes a role in the caller's own org", async () => {
    await directAdmin()
    const target = await makeUser()

    expect((await grant(target.id, 'teacher')).status).toBe(200)
    expect(await grantsOf(target.id, 'teacher')).toEqual([{ orgId: target.orgId }])

    expect((await revoke(target.id, 'teacher')).status).toBe(200)
    expect(await grantsOf(target.id, 'teacher')).toEqual([])
  })

  it('answers 404 for a user in another org, and changes nothing', async () => {
    await directAdmin()
    const school = await makeOrg()
    const target = await makeUser({ orgId: school.id })
    await grantRole(target.id, 'teacher')

    expect((await grant(target.id, 'admin')).status).toBe(404)
    expect(await grantsOf(target.id, 'admin')).toEqual([])

    expect((await revoke(target.id, 'teacher')).status).toBe(404)
    expect(await grantsOf(target.id, 'teacher')).toEqual([{ orgId: school.id }])
  })

  it('does not let a school admin grant a role to a Direct user', async () => {
    const school = await makeOrg()
    const schoolAdmin = await makeUser({ orgId: school.id })
    await grantRole(schoolAdmin.id, 'admin')
    signIn(schoolAdmin)
    const target = await makeUser()

    expect((await grant(target.id, 'admin')).status).toBe(404)
    expect(await grantsOf(target.id, 'admin')).toEqual([])
  })

  it('refuses to grant or revoke platform_admin', async () => {
    await directAdmin()
    const target = await makeUser()
    await grantRole(target.id, 'platform_admin')

    expect((await grant(target.id, 'platform_admin')).status).toBe(400)
    expect((await revoke(target.id, 'platform_admin')).status).toBe(400)
    expect(await grantsOf(target.id, 'platform_admin')).toEqual([{ orgId: null }])
  })

  it('still refuses to revoke your own admin role', async () => {
    const admin = await directAdmin()
    expect((await revoke(admin.id, 'admin')).status).toBe(400)
    expect(await grantsOf(admin.id, 'admin')).toHaveLength(1)
  })

  it('refuses a caller without roles:manage', async () => {
    const teacher = await makeUser()
    await grantRole(teacher.id, 'teacher')
    signIn(teacher)
    const target = await makeUser()
    expect((await grant(target.id, 'teacher')).status).toBe(403)
  })
})
