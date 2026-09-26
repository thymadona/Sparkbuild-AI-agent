/**
 * Adding people to an org from /staff: one by email (/api/admin/people), by
 * CSV (/api/admin/people/import), through the older New Student modal
 * (/api/admin/students), and revoking an invite. The session is mocked;
 * permissions and the database are real.
 */
const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))

import { and, eq } from 'drizzle-orm'
import { POST as addPerson } from '@/app/api/admin/people/route'
import { POST as importPeople } from '@/app/api/admin/people/import/route'
import { POST as createStudent } from '@/app/api/admin/students/route'
import { GET as listInvites } from '@/app/api/admin/invites/route'
import { DELETE as revokeInvite } from '@/app/api/admin/invites/[id]/route'
import { db } from '@/lib/db/client'
import { orgInvites, roles, studentProfiles, userRoles, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { grantRole, makeOrg, makeUser, resetDb } from '@/__tests__/helpers/db'

beforeEach(async () => {
  await resetDb()
  mockGetSessionUser.mockReset()
})
afterAll(() => db.$client.end())

type User = Awaited<ReturnType<typeof makeUser>>

const signIn = (user: User) =>
  mockGetSessionUser.mockResolvedValue({ id: user.id, orgId: user.orgId })
const post = (body: unknown) =>
  new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

async function schoolAdmin() {
  const org = await makeOrg()
  const admin = await makeUser({ orgId: org.id })
  await grantRole(admin.id, 'admin')
  signIn(admin)
  return { org, admin }
}

const userByEmail = async (email: string) =>
  (await db.select().from(users).where(eq(users.email, email)))[0]

async function roleNames(userId: string) {
  const rows = await db
    .select({ name: roles.name, orgId: userRoles.orgId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
  return rows
}

const invitesFor = (email: string) =>
  db.select().from(orgInvites).where(eq(orgInvites.email, email))

describe('POST /api/admin/people', () => {
  it('pre-provisions a new student in the caller’s org, with a profile and parent email', async () => {
    const { org } = await schoolAdmin()
    const res = await addPerson(
      post({
        email: ' Dara@School.test ',
        name: 'Sok Dara',
        role: 'student',
        parentEmail: 'mum@home.test',
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'created' })

    const dara = await userByEmail('dara@school.test')
    expect(dara.orgId).toBe(org.id)
    expect(await roleNames(dara.id)).toEqual([{ name: 'student', orgId: org.id }])
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, dara.id))
    expect(profile).toMatchObject({ fullName: 'Sok Dara', parentEmail: 'mum@home.test' })
  })

  it('pre-provisions a new teacher with the teacher role and no student profile', async () => {
    const { org } = await schoolAdmin()
    const res = await addPerson(post({ email: 't@school.test', name: 'Ms T', role: 'teacher' }))
    expect(await res.json()).toMatchObject({ status: 'created' })

    const teacher = await userByEmail('t@school.test')
    expect(await roleNames(teacher.id)).toEqual([{ name: 'teacher', orgId: org.id }])
    expect(
      await db.select().from(studentProfiles).where(eq(studentProfiles.userId, teacher.id))
    ).toHaveLength(0)
  })

  it('invites a SparkBuild Direct account instead of moving it, and re-adding updates that invite', async () => {
    const { org } = await schoolAdmin()
    const direct = await makeUser({ email: 'kid@direct.test' })

    const res = await addPerson(post({ email: 'kid@direct.test', name: 'Kid', role: 'student' }))
    expect(await res.json()).toMatchObject({ status: 'invited' })
    await addPerson(post({ email: 'kid@direct.test', name: 'Kid', role: 'teacher' }))

    expect((await userByEmail('kid@direct.test')).orgId).toBe(DIRECT_ORG_ID)
    expect(await roleNames(direct.id)).toEqual([])
    const invites = await invitesFor('kid@direct.test')
    expect(invites).toHaveLength(1)
    expect(invites[0]).toMatchObject({ orgId: org.id, role: 'teacher', status: 'pending' })
  })

  it('refuses an email in another school with 409 and writes nothing', async () => {
    await schoolAdmin()
    const other = await makeOrg()
    const theirs = await makeUser({ orgId: other.id, email: 'theirs@other.test' })

    const res = await addPerson(post({ email: 'theirs@other.test', name: 'X', role: 'student' }))
    expect(res.status).toBe(409)
    expect((await userByEmail('theirs@other.test')).orgId).toBe(other.id)
    expect(await roleNames(theirs.id)).toEqual([])
    expect(await invitesFor('theirs@other.test')).toHaveLength(0)
  })

  it('always writes to the session’s org, ignoring any org in the body', async () => {
    const { org } = await schoolAdmin()
    const other = await makeOrg()
    await addPerson(post({ email: 'n@x.test', name: 'N', role: 'student', orgId: other.id }))
    expect((await userByEmail('n@x.test')).orgId).toBe(org.id)
  })

  it('refuses callers without the matching permission, and bad input', async () => {
    const org = await makeOrg()
    const teacher = await makeUser({ orgId: org.id })
    await grantRole(teacher.id, 'teacher')
    signIn(teacher)
    expect((await addPerson(post({ email: 'a@x.test', name: 'A', role: 'student' }))).status).toBe(
      403
    )
    expect((await addPerson(post({ email: 'a@x.test', name: 'A', role: 'teacher' }))).status).toBe(
      403
    )
    expect(await userByEmail('a@x.test')).toBeUndefined()

    await schoolAdmin()
    expect((await addPerson(post({ email: 'a@x.test', name: 'A', role: 'admin' }))).status).toBe(
      400
    )
    expect((await addPerson(post({ email: 'nope', name: 'A', role: 'student' }))).status).toBe(400)
    expect((await addPerson(post({ email: 'a@x.test', name: ' ', role: 'student' }))).status).toBe(
      400
    )

    mockGetSessionUser.mockResolvedValue(null)
    expect((await addPerson(post({ email: 'a@x.test', name: 'A', role: 'student' }))).status).toBe(
      401
    )
  })
})

describe('POST /api/admin/people/import', () => {
  it('adds the good rows and reports every bad one with a reason', async () => {
    const { org } = await schoolAdmin()
    const other = await makeOrg()
    await makeUser({ orgId: other.id, email: 'taken@other.test' })
    await makeUser({ email: 'direct@x.test' })

    const csv = [
      'email,name,role,parent_email',
      's1@school.test,Student One,student,mum@home.test',
      'bad-email,Nobody,student,',
      't1@school.test,Teacher One,teacher,',
      'taken@other.test,Taken,student,',
      'direct@x.test,Direct Kid,student,',
      'boss@school.test,Boss,admin,',
    ].join('\n')

    const res = await importPeople(post({ csv }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.added).toEqual([
      { line: 2, email: 's1@school.test', status: 'created' },
      { line: 4, email: 't1@school.test', status: 'created' },
      { line: 6, email: 'direct@x.test', status: 'invited' },
    ])
    expect(body.failed).toEqual([
      { line: 3, email: 'bad-email', reason: 'Not a valid email' },
      { line: 5, email: 'taken@other.test', reason: expect.stringContaining('another school') },
      { line: 7, email: 'boss@school.test', reason: 'Role must be student or teacher' },
    ])

    expect((await userByEmail('s1@school.test')).orgId).toBe(org.id)
    expect((await userByEmail('t1@school.test')).orgId).toBe(org.id)
    expect((await userByEmail('taken@other.test')).orgId).toBe(other.id)
    expect((await userByEmail('direct@x.test')).orgId).toBe(DIRECT_ORG_ID)
    expect(await userByEmail('boss@school.test')).toBeUndefined()
  })

  it('refuses a whole file with a missing column, and a caller with no add permission', async () => {
    await schoolAdmin()
    expect((await importPeople(post({ csv: 'email,name\na@x.test,A' }))).status).toBe(400)
    expect((await importPeople(post({}))).status).toBe(400)

    const org = await makeOrg()
    const teacher = await makeUser({ orgId: org.id })
    await grantRole(teacher.id, 'teacher')
    signIn(teacher)
    const res = await importPeople(post({ csv: 'email,name,role\na@x.test,A,student' }))
    expect(res.status).toBe(403)
    expect(await userByEmail('a@x.test')).toBeUndefined()
  })
})

describe('POST /api/admin/students (New Student modal)', () => {
  it('invites a Direct account and refuses someone already in the org without changing them', async () => {
    const { org } = await schoolAdmin()
    await makeUser({ email: 'direct@x.test' })
    const teacher = await makeUser({ orgId: org.id, email: 'teach@school.test' })
    await grantRole(teacher.id, 'teacher')

    const invited = await createStudent(post({ email: 'direct@x.test', full_name: 'D' }))
    expect(await invited.json()).toMatchObject({ status: 'invited' })
    expect((await userByEmail('direct@x.test')).orgId).toBe(DIRECT_ORG_ID)

    const again = await createStudent(post({ email: 'teach@school.test', full_name: 'T' }))
    expect(again.status).toBe(409)
    expect((await roleNames(teacher.id)).map((r) => r.name)).toEqual(['teacher'])
  })

  it('creates a new student with the modal’s extra fields', async () => {
    const { org } = await schoolAdmin()
    const res = await createStudent(
      post({ email: 'new@school.test', full_name: 'New Kid', notes: 'front row' })
    )
    expect(await res.json()).toMatchObject({ status: 'created' })
    const kid = await userByEmail('new@school.test')
    expect(kid.orgId).toBe(org.id)
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, kid.id))
    expect(profile).toMatchObject({ fullName: 'New Kid', notes: 'front row' })
  })
})

describe('/api/admin/invites', () => {
  it('lists and revokes only the caller’s own org’s invites', async () => {
    const { org } = await schoolAdmin()
    const other = await makeOrg()
    await makeUser({ email: 'mine@x.test' })
    await makeUser({ email: 'theirs@x.test' })
    const [mine] = await db
      .insert(orgInvites)
      .values({ orgId: org.id, email: 'mine@x.test', role: 'student' })
      .returning()
    const [theirs] = await db
      .insert(orgInvites)
      .values({ orgId: other.id, email: 'theirs@x.test', role: 'student' })
      .returning()

    const listed = await (await listInvites()).json()
    expect(listed.invites.map((i: { id: string }) => i.id)).toEqual([mine.id])

    const req = new Request('http://x', { method: 'DELETE' })
    expect((await revokeInvite(req, params(theirs.id))).status).toBe(404)
    expect((await revokeInvite(req, params('not-a-uuid'))).status).toBe(404)
    expect((await revokeInvite(req, params(mine.id))).status).toBe(200)
    expect((await revokeInvite(req, params(mine.id))).status).toBe(404)

    const rows = await db
      .select({ id: orgInvites.id, status: orgInvites.status })
      .from(orgInvites)
      .where(and(eq(orgInvites.status, 'pending')))
    expect(rows).toEqual([{ id: theirs.id, status: 'pending' }])
  })
})
