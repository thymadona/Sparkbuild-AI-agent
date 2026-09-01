import { db } from '@/lib/db/client'
import { invoices } from '@/lib/db/schema'
import { getSchoolOverviewStats } from '@/app/staff/overview-stats'
import {
  addClassMember,
  grantRole,
  makeClass,
  makeStudentProfile,
  makeUser,
  resetDb,
} from '@/__tests__/helpers/db'

// These counts moved out of JS and into Postgres aggregates (see
// app/staff/overview-stats.ts) to stop the admin dashboard pulling whole
// tables across the wire. The risk in that change is arithmetic, not
// performance, so every case below pins a number the old post-processing
// produced: staff excluded from the student count, a teacher counted once
// across several classes, and overdue judged against due_date.
beforeEach(resetDb)
afterAll(() => db.$client.end())

describe('getSchoolOverviewStats', () => {
  it('counts an empty school as all zeros', async () => {
    const stats = await getSchoolOverviewStats()

    expect(stats.totalClasses).toBe(0)
    expect(stats.activeStudentCount).toBe(0)
    expect(stats.teacherCount).toBe(0)
    expect(stats.unpaidCount).toBe(0)
    expect(stats.overdueCount).toBe(0)
  })

  it('excludes inactive profiles and staff from the active student count', async () => {
    const student = await makeUser()
    await grantRole(student.id, 'student')
    await makeStudentProfile(student.id)

    const inactive = await makeUser()
    await grantRole(inactive.id, 'student')
    await makeStudentProfile(inactive.id, { isActive: false })

    // Staff who also hold a profile (a teacher's own test account) are not
    // students — this is the anti-join that replaced a JS set difference.
    const teacher = await makeUser()
    await grantRole(teacher.id, 'teacher')
    await makeStudentProfile(teacher.id)

    const admin = await makeUser()
    await grantRole(admin.id, 'admin')
    await makeStudentProfile(admin.id)

    const stats = await getSchoolOverviewStats()

    expect(stats.activeStudentCount).toBe(1)
  })

  it('counts a teacher once however many classes they teach', async () => {
    const teacher = await makeUser()
    await grantRole(teacher.id, 'teacher')
    const a = await makeClass()
    const b = await makeClass()
    await addClassMember(a.id, teacher.id, 'teacher')
    await addClassMember(b.id, teacher.id, 'teacher')

    // A student member of a class is not a teacher of it.
    const student = await makeUser()
    await addClassMember(a.id, student.id, 'student')

    const stats = await getSchoolOverviewStats()

    expect(stats.teacherCount).toBe(1)
    expect(stats.totalClasses).toBe(2)
  })

  it('splits unpaid invoices into overdue and not-yet-due, ignoring paid ones', async () => {
    const user = await makeUser()
    await db.insert(invoices).values([
      { userId: user.id, amountCents: 100, description: 'overdue a', dueDate: '2020-01-01' },
      { userId: user.id, amountCents: 100, description: 'overdue b', dueDate: '2021-06-15' },
      { userId: user.id, amountCents: 100, description: 'not yet due', dueDate: '2999-12-31' },
      {
        userId: user.id,
        amountCents: 100,
        description: 'paid but overdue',
        dueDate: '2020-01-01',
        status: 'paid',
      },
    ])

    const stats = await getSchoolOverviewStats()

    expect(stats.unpaidCount).toBe(3)
    expect(stats.overdueCount).toBe(2)
  })
})
