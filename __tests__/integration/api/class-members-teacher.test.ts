/**
 * A teacher's roster rights on /api/admin/classes/[id]/members: add and
 * remove student members of their own org in a class they teach, and
 * nothing else. The session is mocked; permissions and the database are real.
 */
const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))

import { eq } from 'drizzle-orm'
import {
  DELETE as removeMember,
  POST as addMember,
} from '@/app/api/admin/classes/[id]/members/route'
import { db } from '@/lib/db/client'
import { classMembers } from '@/lib/db/schema'
import {
  addClassMember,
  grantRole,
  makeClass,
  makeOrg,
  makeUser,
  resetDb,
} from '@/__tests__/helpers/db'

beforeEach(async () => {
  await resetDb()
  mockGetSessionUser.mockReset()
})
afterAll(() => db.$client.end())

type User = Awaited<ReturnType<typeof makeUser>>

const signIn = (user: User) =>
  mockGetSessionUser.mockResolvedValue({ id: user.id, orgId: user.orgId })
const add = (classId: string, body: unknown) =>
  addMember(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: classId }),
  })
const remove = (classId: string, userId: string) =>
  removeMember(new Request(`http://x?userId=${userId}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id: classId }),
  })
const membersOf = async (classId: string) =>
  (await db.select().from(classMembers).where(eq(classMembers.classId, classId))).map((m) => ({
    userId: m.userId,
    role: m.role,
  }))

async function person(orgId: string, role: 'student' | 'teacher' | 'admin') {
  const user = await makeUser({ orgId })
  await grantRole(user.id, role)
  return user
}

async function school() {
  const org = await makeOrg()
  const teacher = await person(org.id, 'teacher')
  const cls = await makeClass({ orgId: org.id })
  await addClassMember(cls.id, teacher.id, 'teacher')
  const student = await person(org.id, 'student')
  return { org, teacher, cls, student }
}

describe('a teacher on their own class', () => {
  it('adds and removes a student of their org', async () => {
    const { teacher, cls, student } = await school()
    signIn(teacher)

    expect((await add(cls.id, { userId: student.id })).status).toBe(200)
    expect(await membersOf(cls.id)).toContainEqual({ userId: student.id, role: 'student' })

    expect((await remove(cls.id, student.id)).status).toBe(200)
    expect((await membersOf(cls.id)).map((m) => m.userId)).not.toContain(student.id)
  })

  it('refuses adding a teacher-role user, and a promoted student', async () => {
    const { org, teacher, cls } = await school()
    const other = await person(org.id, 'teacher')
    const promoted = await person(org.id, 'student')
    await grantRole(promoted.id, 'teacher')
    signIn(teacher)

    expect((await add(cls.id, { userId: other.id })).status).toBe(403)
    expect((await add(cls.id, { userId: promoted.id })).status).toBe(403)
    expect((await membersOf(cls.id)).map((m) => m.userId)).toEqual([teacher.id])
  })

  it('refuses making a student a teacher member', async () => {
    const { teacher, cls, student } = await school()
    signIn(teacher)
    expect((await add(cls.id, { userId: student.id, role: 'teacher' })).status).toBe(403)
    expect((await membersOf(cls.id)).map((m) => m.userId)).toEqual([teacher.id])
  })

  it('refuses removing a teacher member', async () => {
    const { org, teacher, cls } = await school()
    const coTeacher = await person(org.id, 'teacher')
    await addClassMember(cls.id, coTeacher.id, 'teacher')
    signIn(teacher)
    expect((await remove(cls.id, coTeacher.id)).status).toBe(403)
    expect((await membersOf(cls.id)).map((m) => m.userId)).toContain(coTeacher.id)
  })

  it('answers 404 for a user from another org', async () => {
    const { teacher, cls } = await school()
    const elsewhere = await makeOrg()
    const outsider = await person(elsewhere.id, 'student')
    const direct = await makeUser()
    await grantRole(direct.id, 'student')
    signIn(teacher)

    expect((await add(cls.id, { userId: outsider.id })).status).toBe(404)
    expect((await add(cls.id, { userId: direct.id })).status).toBe(404)
    expect((await membersOf(cls.id)).map((m) => m.userId)).toEqual([teacher.id])
  })

  it('answers 404 removing an outsider planted in the class', async () => {
    const { teacher, cls } = await school()
    const outsider = await makeUser()
    await grantRole(outsider.id, 'student')
    await addClassMember(cls.id, outsider.id, 'student')
    signIn(teacher)
    expect((await remove(cls.id, outsider.id)).status).toBe(404)
    expect((await membersOf(cls.id)).map((m) => m.userId)).toContain(outsider.id)
  })
})

describe('a teacher on a class they do not teach', () => {
  it('is refused on another teacher’s class in their org', async () => {
    const { org, teacher, student } = await school()
    const theirs = await makeClass({ orgId: org.id })
    const kid = await person(org.id, 'student')
    await addClassMember(theirs.id, kid.id, 'student')
    signIn(teacher)

    expect((await add(theirs.id, { userId: student.id })).status).toBe(403)
    expect((await remove(theirs.id, kid.id)).status).toBe(403)
    expect((await membersOf(theirs.id)).map((m) => m.userId)).toEqual([kid.id])
  })

  it('answers 404 on another org’s class, even if planted in it as teacher', async () => {
    const { teacher, student } = await school()
    const other = await makeOrg()
    const theirs = await makeClass({ orgId: other.id })
    await addClassMember(theirs.id, teacher.id, 'teacher')
    signIn(teacher)

    expect((await add(theirs.id, { userId: student.id })).status).toBe(404)
    expect((await membersOf(theirs.id)).map((m) => m.userId)).toEqual([teacher.id])
  })

  it('refuses a plain student', async () => {
    const { cls, student } = await school()
    signIn(student)
    expect((await add(cls.id, { userId: student.id })).status).toBe(403)
  })
})

describe('an admin with classes:manage', () => {
  it('still adds a teacher member', async () => {
    const { org, cls } = await school()
    const admin = await person(org.id, 'admin')
    const coTeacher = await person(org.id, 'teacher')
    signIn(admin)

    expect((await add(cls.id, { userId: coTeacher.id, role: 'teacher' })).status).toBe(200)
    expect(await membersOf(cls.id)).toContainEqual({ userId: coTeacher.id, role: 'teacher' })
  })
})
