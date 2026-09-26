/**
 * app/api/admin/*: every staff read and write is scoped to the caller's org.
 * The session is mocked; permissions and the database are real, so the org
 * predicates are the ones production runs. Telegram's fetch is mocked.
 */
const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))

import { eq } from 'drizzle-orm'
import { GET as listClasses } from '@/app/api/admin/classes/route'
import { DELETE as deleteClass, PATCH as patchClass } from '@/app/api/admin/classes/[id]/route'
import { POST as toggleLesson } from '@/app/api/admin/classes/[id]/lessons/route'
import {
  DELETE as removeMember,
  POST as addMember,
} from '@/app/api/admin/classes/[id]/members/route'
import {
  DELETE as deleteSchedule,
  PATCH as patchSchedule,
  POST as createSchedule,
} from '@/app/api/admin/schedules/route'
import { PATCH as patchStudent } from '@/app/api/admin/students/[id]/route'
import { GET as listInvoices, POST as createInvoice } from '@/app/api/admin/invoices/route'
import { DELETE as deleteInvoice, PATCH as patchInvoice } from '@/app/api/admin/invoices/[id]/route'
import { POST as payInvoice } from '@/app/api/admin/invoices/[id]/pay/route'
import { POST as sendInvoice } from '@/app/api/admin/invoices/[id]/send/route'
import { db } from '@/lib/db/client'
import {
  classEnabledLessons,
  classMembers,
  classSchedules,
  classes,
  invoices,
  receipts,
  studentProfiles,
} from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'
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

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const json = (method: string, body: unknown, url = 'http://x') =>
  new Request(url, { method, body: JSON.stringify(body) })

async function makeInvoice(userId: string, orgId: string) {
  const [row] = await db
    .insert(invoices)
    .values({ userId, orgId, amountCents: 1000, description: 'Term 1', dueDate: '2030-01-01' })
    .returning()
  return row
}

// Two orgs, each with an admin, a teacher, a class, a student with a profile
// (and a parent chat id), an invoice and a schedule.
async function makeSchool(orgId: string) {
  const admin = await makeUser({ orgId })
  await grantRole(admin.id, 'admin')
  const teacher = await makeUser({ orgId })
  await grantRole(teacher.id, 'teacher')
  const student = await makeUser({ orgId })
  await grantRole(student.id, 'student')
  await makeStudentProfile(student.id, { parentTelegramChatId: '123' })
  const cls = await makeClass({ orgId })
  await addClassMember(cls.id, teacher.id, 'teacher')
  await addClassMember(cls.id, student.id, 'student')
  const invoice = await makeInvoice(student.id, orgId)
  const [schedule] = await db
    .insert(classSchedules)
    .values({ classId: cls.id, dayOfWeek: 1, startTime: '10:00' })
    .returning()
  return { admin, teacher, student, cls, invoice, schedule }
}

let a: Awaited<ReturnType<typeof makeSchool>>
let b: Awaited<ReturnType<typeof makeSchool>>
const fetchMock = jest.fn()
const realFetch = global.fetch

beforeEach(async () => {
  await resetDb()
  mockGetSessionUser.mockReset()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ json: async () => ({ ok: true }) })
  global.fetch = fetchMock as unknown as typeof fetch
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  a = await makeSchool(DIRECT_ORG_ID)
  b = await makeSchool((await makeOrg()).id)
  signIn(a.admin)
})
afterAll(async () => {
  global.fetch = realFetch
  await db.$client.end()
})

describe('lists', () => {
  it('lists only the caller org’s classes and invoices', async () => {
    const cls = (await (await listClasses()).json()) as { id: string }[]
    expect(cls.map((c) => c.id)).toEqual([a.cls.id])

    const inv = (await (await listInvoices(new Request('http://x'))).json()) as { id: string }[]
    expect(inv.map((i) => i.id)).toEqual([a.invoice.id])

    const byUser = await listInvoices(new Request(`http://x?userId=${b.student.id}`))
    expect(await byUser.json()).toEqual([])
  })
})

describe('classes', () => {
  it('answers 404 to PATCH and DELETE on another org’s class, and changes nothing', async () => {
    expect((await patchClass(json('PATCH', { name: 'Hijacked' }), ctx(b.cls.id))).status).toBe(404)
    expect((await deleteClass(new Request('http://x'), ctx(b.cls.id))).status).toBe(404)

    const [row] = await db.select().from(classes).where(eq(classes.id, b.cls.id))
    expect(row.name).toBe(b.cls.name)
  })

  it('still edits and deletes its own class', async () => {
    expect((await patchClass(json('PATCH', { name: 'Renamed' }), ctx(a.cls.id))).status).toBe(200)
    expect((await deleteClass(new Request('http://x'), ctx(a.cls.id))).status).toBe(200)
  })
})

describe('class members', () => {
  const membersOf = (classId: string) =>
    db.select().from(classMembers).where(eq(classMembers.classId, classId))

  it('refuses an org-B student into an org-A class', async () => {
    const res = await addMember(json('POST', { userId: b.student.id }), ctx(a.cls.id))
    expect(res.status).toBe(404)
    expect((await membersOf(a.cls.id)).map((m) => m.userId)).not.toContain(b.student.id)
  })

  it('refuses any member into an org-B class, and removing one from it', async () => {
    const extra = await makeUser()
    expect((await addMember(json('POST', { userId: extra.id }), ctx(b.cls.id))).status).toBe(404)
    expect(
      (
        await removeMember(
          new Request(`http://x?userId=${b.student.id}`, { method: 'DELETE' }),
          ctx(b.cls.id)
        )
      ).status
    ).toBe(404)
    expect(await membersOf(b.cls.id)).toHaveLength(2)
  })

  it('still adds an own-org student to an own-org class', async () => {
    const student = await makeUser()
    expect((await addMember(json('POST', { userId: student.id }), ctx(a.cls.id))).status).toBe(200)
    expect((await membersOf(a.cls.id)).map((m) => m.userId)).toContain(student.id)
  })
})

describe('lesson unlocks', () => {
  const unlocksOf = (classId: string) =>
    db.select().from(classEnabledLessons).where(eq(classEnabledLessons.classId, classId))
  const unlock = (classId: string) =>
    toggleLesson(json('POST', { lessonId: 102, enabled: true }), ctx(classId))

  it('refuses an org-A admin in an org-B class', async () => {
    expect((await unlock(b.cls.id)).status).toBe(404)
    expect(await unlocksOf(b.cls.id)).toEqual([])
  })

  it('refuses an org-A teacher planted in an org-B class', async () => {
    await addClassMember(b.cls.id, a.teacher.id, 'teacher')
    signIn(a.teacher)
    expect((await unlock(b.cls.id)).status).toBe(404)
    expect(await unlocksOf(b.cls.id)).toEqual([])
  })

  it('still unlocks for the org’s admin and the class’s teacher', async () => {
    expect((await unlock(a.cls.id)).status).toBe(200)
    signIn(a.teacher)
    expect(
      (await toggleLesson(json('POST', { lessonId: 103, enabled: true }), ctx(a.cls.id))).status
    ).toBe(200)
    expect((await unlocksOf(a.cls.id)).map((r) => r.lessonId).sort()).toEqual([102, 103])
  })
})

describe('schedules', () => {
  it('refuses to create, edit or delete a schedule in an org-B class', async () => {
    const created = await createSchedule(
      json('POST', { class_id: b.cls.id, day_of_week: 2, start_time: '09:00' })
    )
    expect(created.status).toBe(404)

    const url = `http://x?id=${b.schedule.id}`
    expect((await patchSchedule(json('PATCH', { label: 'x' }, url))).status).toBe(404)
    expect((await deleteSchedule(new Request(url, { method: 'DELETE' }))).status).toBe(404)

    const rows = await db.select().from(classSchedules).where(eq(classSchedules.classId, b.cls.id))
    expect(rows).toEqual([b.schedule])
  })

  it('still edits its own schedule', async () => {
    const url = `http://x?id=${a.schedule.id}`
    expect((await patchSchedule(json('PATCH', { label: 'Mon' }, url))).status).toBe(200)
  })
})

describe('students', () => {
  it('answers 404 to PATCH on an org-B student, and changes nothing', async () => {
    const res = await patchStudent(json('PATCH', { is_active: false }), ctx(b.student.id))
    expect(res.status).toBe(404)
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, b.student.id))
    expect(profile.isActive).toBe(true)
  })

  it('still updates its own student', async () => {
    const res = await patchStudent(json('PATCH', { is_active: false }), ctx(a.student.id))
    expect(res.status).toBe(200)
  })
})

describe('invoices', () => {
  const invoiceRow = async (id: string) =>
    (await db.select().from(invoices).where(eq(invoices.id, id)))[0]

  it('refuses to create an invoice for an org-B student', async () => {
    const res = await createInvoice(
      json('POST', {
        user_id: b.student.id,
        amount_cents: 500,
        description: 'x',
        due_date: '2030-01-01',
      })
    )
    expect(res.status).toBe(404)
    expect(await db.select().from(invoices).where(eq(invoices.userId, b.student.id))).toHaveLength(
      1
    )
  })

  it('still invoices an own-org student, in the caller’s org', async () => {
    const res = await createInvoice(
      json('POST', {
        user_id: a.student.id,
        amount_cents: 500,
        description: 'x',
        due_date: '2030-01-01',
      })
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { org_id: string }).org_id).toBe(DIRECT_ORG_ID)
  })

  it('answers 404 to edit, delete, pay or send an org-B invoice, and changes nothing', async () => {
    expect((await patchInvoice(json('PATCH', { amount_cents: 1 }), ctx(b.invoice.id))).status).toBe(
      404
    )
    expect((await deleteInvoice(new Request('http://x'), ctx(b.invoice.id))).status).toBe(404)
    expect((await payInvoice(new Request('http://x'), ctx(b.invoice.id))).status).toBe(404)
    expect((await sendInvoice(new Request('http://x'), ctx(b.invoice.id))).status).toBe(404)

    expect(await invoiceRow(b.invoice.id)).toEqual(b.invoice)
    expect(await db.select().from(receipts)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still pays and sends its own invoice', async () => {
    expect((await payInvoice(new Request('http://x'), ctx(a.invoice.id))).status).toBe(200)
    const [receipt] = await db.select().from(receipts)
    expect(receipt.orgId).toBe(DIRECT_ORG_ID)

    expect((await sendInvoice(new Request('http://x'), ctx(a.invoice.id))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((await invoiceRow(a.invoice.id)).sentAt).not.toBeNull()
  })
})
