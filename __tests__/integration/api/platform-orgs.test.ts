/**
 * /api/platform/orgs*: the platform owner's console API. The session is
 * mocked; permissions and the database are real.
 */
const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))

import { and, eq } from 'drizzle-orm'
import { POST as createOrg } from '@/app/api/platform/orgs/route'
import { PATCH as patchOrg } from '@/app/api/platform/orgs/[id]/route'
import { POST as addAdmin } from '@/app/api/platform/orgs/[id]/admins/route'
import { db } from '@/lib/db/client'
import { orgInvites, organizations, roles, userRoles, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'
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

async function platformOwner() {
  const owner = await makeUser()
  await grantRole(owner.id, 'platform_admin')
  await grantRole(owner.id, 'admin')
  signIn(owner)
  return owner
}

const json = (body: unknown, method = 'POST') =>
  new Request('http://x', { method, body: JSON.stringify(body) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

const create = (body: Record<string, unknown>) =>
  createOrg(
    json({ name: 'Riverside', slug: 'riverside', adminEmail: 'head@riverside.test', ...body })
  )

async function rolesOf(userId: string) {
  const rows = await db
    .select({ name: roles.name, orgId: userRoles.orgId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
  return rows
}

const orgBySlug = async (slug: string) =>
  (await db.select().from(organizations).where(eq(organizations.slug, slug)))[0]

describe('platform routes: who may call them', () => {
  it('refuses a Direct admin who is not the platform owner', async () => {
    const admin = await makeUser()
    await grantRole(admin.id, 'admin')
    signIn(admin)
    const school = await makeOrg()

    expect((await create({})).status).toBe(403)
    expect((await patchOrg(json({ status: 'suspended' }, 'PATCH'), params(school.id))).status).toBe(
      403
    )
    expect((await addAdmin(json({ email: 'x@y.test' }), params(school.id))).status).toBe(403)
    expect(await orgBySlug('riverside')).toBeUndefined()
  })

  it('answers 401 when signed out', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    expect((await create({})).status).toBe(401)
  })
})

describe('POST /api/platform/orgs', () => {
  it('creates a school and pre-provisions a new email as its admin', async () => {
    await platformOwner()
    const res = await create({ adminName: 'Head Teacher' })
    expect(res.status).toBe(200)
    expect((await res.json()).admin.status).toBe('created')

    const org = await orgBySlug('riverside')
    expect(org).toMatchObject({ name: 'Riverside', status: 'active' })
    const [head] = await db.select().from(users).where(eq(users.email, 'head@riverside.test'))
    expect(head).toMatchObject({ orgId: org.id, name: 'Head Teacher', emailVerified: true })
    expect(await rolesOf(head.id)).toEqual([{ name: 'admin', orgId: org.id }])
  })

  it('invites a Direct account instead of taking it', async () => {
    await platformOwner()
    const direct = await makeUser({ email: 'head@riverside.test' })
    await grantRole(direct.id, 'student')

    const res = await create({ adminEmail: '  Head@Riverside.test ' })
    expect(res.status).toBe(200)
    expect((await res.json()).admin.status).toBe('invited')

    const org = await orgBySlug('riverside')
    const [after] = await db.select().from(users).where(eq(users.id, direct.id))
    expect(after.orgId).toBe(DIRECT_ORG_ID)
    expect(await rolesOf(direct.id)).toEqual([{ name: 'student', orgId: DIRECT_ORG_ID }])
    const invites = await db.select().from(orgInvites).where(eq(orgInvites.orgId, org.id))
    expect(invites).toMatchObject([
      { email: 'head@riverside.test', role: 'admin', status: 'pending' },
    ])
  })

  it('refuses an email that belongs to another school, and creates no org', async () => {
    await platformOwner()
    const other = await makeOrg()
    await makeUser({ email: 'head@riverside.test', orgId: other.id })

    expect((await create({})).status).toBe(409)
    expect(await orgBySlug('riverside')).toBeUndefined()
  })

  it('refuses a taken slug', async () => {
    await platformOwner()
    await makeOrg({ slug: 'riverside' })
    expect((await create({ adminEmail: 'new@riverside.test' })).status).toBe(409)
  })

  it.each(['app', 'console', 'Not A Slug', '-x', ''])('refuses the slug %p', async (slug) => {
    await platformOwner()
    expect((await create({ slug })).status).toBe(400)
  })

  it('refuses a missing name or a bad email', async () => {
    await platformOwner()
    expect((await create({ name: ' ' })).status).toBe(400)
    expect((await create({ adminEmail: 'nope' })).status).toBe(400)
  })
})

describe('PATCH /api/platform/orgs/[id]', () => {
  it('suspends and reactivates a school', async () => {
    await platformOwner()
    const school = await makeOrg()

    const res = await patchOrg(json({ status: 'suspended' }, 'PATCH'), params(school.id))
    expect(res.status).toBe(200)
    expect((await orgBySlug(school.slug)).status).toBe('suspended')

    await patchOrg(json({ status: 'active' }, 'PATCH'), params(school.id))
    expect((await orgBySlug(school.slug)).status).toBe('active')
  })

  it('never suspends SparkBuild Direct', async () => {
    await platformOwner()
    const res = await patchOrg(json({ status: 'suspended' }, 'PATCH'), params(DIRECT_ORG_ID))
    expect(res.status).toBe(400)
    const [direct] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, DIRECT_ORG_ID))
    expect(direct.status).toBe('active')
  })

  it('answers 404 for an unknown or malformed id, and 400 for a bad status', async () => {
    await platformOwner()
    const school = await makeOrg()
    const missing = '00000000-0000-4000-8000-00000000abcd'
    expect((await patchOrg(json({ status: 'active' }, 'PATCH'), params(missing))).status).toBe(404)
    expect((await patchOrg(json({ status: 'active' }, 'PATCH'), params('x'))).status).toBe(404)
    expect((await patchOrg(json({ status: 'gone' }, 'PATCH'), params(school.id))).status).toBe(400)
  })
})

describe('POST /api/platform/orgs/[id]/admins', () => {
  it('makes an existing member of the school an admin', async () => {
    await platformOwner()
    const school = await makeOrg()
    const teacher = await makeUser({ orgId: school.id })
    await grantRole(teacher.id, 'teacher')

    const res = await addAdmin(json({ email: teacher.email }), params(school.id))
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('granted')
    const names = (await rolesOf(teacher.id)).map((r) => r.name).sort()
    expect(names).toEqual(['admin', 'teacher'])
  })

  it('re-inviting a Direct account keeps one open invite', async () => {
    await platformOwner()
    const school = await makeOrg()
    const direct = await makeUser()

    await addAdmin(json({ email: direct.email }), params(school.id))
    await addAdmin(json({ email: direct.email }), params(school.id))
    const invites = await db
      .select()
      .from(orgInvites)
      .where(and(eq(orgInvites.orgId, school.id), eq(orgInvites.status, 'pending')))
    expect(invites).toHaveLength(1)
  })

  it('answers 404 for an unknown org and 409 for another school’s email', async () => {
    await platformOwner()
    const school = await makeOrg()
    const other = await makeOrg()
    const theirs = await makeUser({ orgId: other.id })

    const missing = '00000000-0000-4000-8000-00000000abcd'
    expect((await addAdmin(json({ email: 'a@b.test' }), params(missing))).status).toBe(404)
    expect((await addAdmin(json({ email: theirs.email }), params(school.id))).status).toBe(409)
    expect(await rolesOf(theirs.id)).toEqual([])
  })
})
