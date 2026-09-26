/**
 * /staff pages list, count and open only the viewer's org. Loaders and
 * permission helpers are called directly; the detail pages are called as
 * functions with the session mocked, the database real.
 */
const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))

import { db } from '@/lib/db/client'
import { invoices, receipts } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { getStaffContext, getTeacherClassIds, isTeacherOfClass } from '@/lib/auth/permissions'
import { getSchoolOverviewStats } from '@/app/staff/overview-stats'
import { loadStudents } from '@/app/staff/students/students-data'
import { loadClasses } from '@/app/staff/classes/classes-data'
import { loadFinance } from '@/app/staff/finance/finance-data'
import { loadUsers } from '@/app/staff/users/users-data'
import ClassDetailPage from '@/app/staff/classes/[id]/page'
import StudentDetailPage from '@/app/staff/students/[id]/page'
import InvoicePage from '@/app/staff/finance/[id]/page'
import UserPage from '@/app/staff/users/[id]/page'
import { loadOrg } from '@/app/console/orgs/orgs-data'
import { loadAllClasses, loadAllStudents, loadAllUsers } from '@/app/console/platform-data'
import {
  addClassMember,
  grantRole,
  makeClass,
  makeOrg,
  makeStudentProfile,
  makeUser,
  resetDb,
} from '@/__tests__/helpers/db'

type User = Awaited<ReturnType<typeof makeUser>>

function signIn(user: User) {
  mockGetSessionUser.mockResolvedValue({ id: user.id, orgId: user.orgId })
}

let seq = 0

// An org with an admin, a teacher, a class, two students (one in the class),
// an unpaid invoice and a paid one with its receipt.
async function makeSchool(orgId: string) {
  const admin = await makeUser({ orgId })
  await grantRole(admin.id, 'admin')
  const teacher = await makeUser({ orgId })
  await grantRole(teacher.id, 'teacher')
  const students = []
  for (let i = 0; i < 2; i++) {
    const s = await makeUser({ orgId })
    await grantRole(s.id, 'student')
    await makeStudentProfile(s.id)
    students.push(s)
  }
  const cls = await makeClass({ orgId })
  await addClassMember(cls.id, teacher.id, 'teacher')
  await addClassMember(cls.id, students[0].id, 'student')
  const [unpaid, paid] = await db
    .insert(invoices)
    .values([
      { userId: students[0].id, orgId, amountCents: 100, description: 'a', dueDate: '2000-01-01' },
      {
        userId: students[1].id,
        orgId,
        amountCents: 100,
        description: 'b',
        dueDate: '2000-01-01',
        status: 'paid',
      },
    ])
    .returning()
  const [receipt] = await db
    .insert(receipts)
    .values({
      invoiceId: paid.id,
      userId: students[1].id,
      orgId,
      amountCents: 100,
      description: 'b',
      paidAt: new Date().toISOString(),
      receiptNumber: `RCP-TEST-${seq++}`,
    })
    .returning()
  return { admin, teacher, students, cls, unpaid, paid, receipt }
}

let a: Awaited<ReturnType<typeof makeSchool>>
let b: Awaited<ReturnType<typeof makeSchool>>

beforeEach(async () => {
  await resetDb()
  mockGetSessionUser.mockReset()
  a = await makeSchool(DIRECT_ORG_ID)
  b = await makeSchool((await makeOrg()).id)
})
afterAll(() => db.$client.end())

const sorted = (ids: string[]) => [...ids].sort()

describe('staff lists see only the viewer’s org', () => {
  it('students', async () => {
    const { rows, classes } = await loadStudents(DIRECT_ORG_ID)
    expect(sorted(rows.map((r) => r.id))).toEqual(sorted(a.students.map((s) => s.id)))
    expect(classes.map((c) => c.id)).toEqual([a.cls.id])
  })

  it('classes, with only own-org teachers and students to pick', async () => {
    const { rows, allTeachers, allStudents } = await loadClasses(DIRECT_ORG_ID)
    expect(rows.map((r) => r.id)).toEqual([a.cls.id])
    expect(allTeachers.map((t) => t.userId)).toEqual([a.teacher.id])
    expect(sorted(allStudents.map((s) => s.userId))).toEqual(sorted(a.students.map((s) => s.id)))
  })

  it('invoices', async () => {
    const { invoices, profileMap } = await loadFinance(DIRECT_ORG_ID)
    expect(sorted(invoices.map((i) => i.id))).toEqual(sorted([a.unpaid.id, a.paid.id]))
    expect(sorted(Object.keys(profileMap))).toEqual(sorted(a.students.map((s) => s.id)))
  })

  it('users', async () => {
    const rows = await loadUsers(DIRECT_ORG_ID)
    expect(sorted(rows.map((r) => r.id))).toEqual(
      sorted([a.admin.id, a.teacher.id, ...a.students.map((s) => s.id)])
    )
  })

  it('the overview counts', async () => {
    const stats = await getSchoolOverviewStats(DIRECT_ORG_ID)
    expect(stats.totalClasses).toBe(1)
    expect(stats.activeStudentCount).toBe(2)
    expect(stats.teacherCount).toBe(1)
    expect(stats.unpaidCount).toBe(1)
    expect(stats.overdueCount).toBe(1)
  })
})

describe('an org-A teacher sees only their own org-A classes', () => {
  beforeEach(() => addClassMember(b.cls.id, a.teacher.id, 'teacher'))

  it('even with a membership planted in an org-B class', async () => {
    expect(await getTeacherClassIds(a.teacher.id)).toEqual([a.cls.id])
    expect((await getStaffContext(a.teacher.id, [])).teacherClassIds).toEqual([a.cls.id])
    expect(await isTeacherOfClass(a.teacher.id, b.cls.id)).toBe(false)
    expect(await isTeacherOfClass(a.teacher.id, a.cls.id)).toBe(true)
  })
})

describe('detail pages answer 404 for another org’s id', () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) })
  const notFound = expect.objectContaining({
    digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404'),
  })

  beforeEach(() => signIn(a.admin))

  it('class', async () => {
    await expect(ClassDetailPage(params(b.cls.id))).rejects.toEqual(notFound)
    await expect(ClassDetailPage(params(a.cls.id))).resolves.toBeTruthy()
  })

  it('student', async () => {
    await expect(StudentDetailPage(params(b.students[0].id))).rejects.toEqual(notFound)
    await expect(StudentDetailPage(params(a.students[0].id))).resolves.toBeTruthy()
  })

  it('invoice', async () => {
    await expect(InvoicePage(params(b.paid.id))).rejects.toEqual(notFound)
    await expect(InvoicePage(params('not-a-uuid'))).rejects.toEqual(notFound)
    await expect(InvoicePage(params(a.paid.id))).resolves.toBeTruthy()
  })

  it('user', async () => {
    await expect(UserPage(params(b.teacher.id))).rejects.toEqual(notFound)
    await expect(UserPage(params(a.teacher.id))).resolves.toBeTruthy()
  })
})

describe('the console’s org detail', () => {
  it('counts one org’s members and classes, and names its admins', async () => {
    const org = await loadOrg(b.cls.orgId)
    expect(org).toMatchObject({ id: b.cls.orgId, members: 4, classes: 1 })
    expect(org!.admins.map((x) => x.email)).toEqual([b.admin.email])
  })

  it('is null for a malformed or unknown id', async () => {
    expect(await loadOrg('nope')).toBeNull()
    expect(await loadOrg('00000000-0000-4000-8000-00000000abcd')).toBeNull()
  })
})

describe('the console’s cross-org lists', () => {
  it('list every org’s classes with their org, counting only same-org members', async () => {
    // A planted cross-org membership must not count toward b's class.
    await addClassMember(b.cls.id, a.students[1].id, 'student')
    const rows = await loadAllClasses()
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(a.cls.id)).toMatchObject({ orgId: DIRECT_ORG_ID, students: 1, teachers: 1 })
    expect(byId.get(b.cls.id)).toMatchObject({ orgId: b.cls.orgId, students: 1, teachers: 1 })
    expect(byId.get(b.cls.id)!.orgName).toBeTruthy()
  })

  it('list every org’s students with their org', async () => {
    const rows = await loadAllStudents()
    expect(sorted(rows.map((r) => r.id))).toEqual(
      sorted([...a.students, ...b.students].map((s) => s.id))
    )
    expect(rows.find((r) => r.id === b.students[0].id)).toMatchObject({
      orgId: b.cls.orgId,
      classes: 1,
    })
  })

  it('list every user with only the roles held in their own org', async () => {
    const rows = await loadAllUsers()
    expect(rows).toHaveLength(8)
    expect(rows.find((r) => r.id === b.admin.id)).toMatchObject({
      orgId: b.cls.orgId,
      roles: ['admin'],
    })
  })
})
