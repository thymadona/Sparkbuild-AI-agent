import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classes, invoices, organizations, userRoles } from '@/lib/db/schema'
import { ensureStudentDefaults } from '@/lib/auth/student-defaults'
import { DIRECT_ORG_ID, DIRECT_ORG_SLUG, orgOfUser } from '@/lib/orgs'
import { grantRole, makeClass, makeOrg, makeUser, resetDb } from '../helpers/db'

beforeEach(resetDb)
afterAll(resetDb)

describe('organizations (D1 group 1)', () => {
  it('keeps the seeded SparkBuild Direct row across resets', async () => {
    const rows = await db.select().from(organizations)
    expect(rows).toEqual([
      expect.objectContaining({
        id: DIRECT_ORG_ID,
        slug: DIRECT_ORG_SLUG,
        name: 'SparkBuild Direct',
        status: 'active',
      }),
    ])
  })

  // Better Auth leaves orgId out of its user insert (lib/auth/index.ts:
  // `input: false`, no defaultValue), so a user row written with no org is
  // exactly what a Google sign-up writes. Better Auth itself is ESM-only and
  // cannot load under Jest; the real sign-in is a by-hand check.
  it('files a user created with no org under Direct', async () => {
    const user = await makeUser()
    expect(user.orgId).toBe(DIRECT_ORG_ID)
  })

  it("grants the sign-in student role in the user's own org", async () => {
    const school = await makeOrg()
    const user = await makeUser({ orgId: school.id })
    await ensureStudentDefaults(user.id, 'Kid')

    const grants = await db
      .select({ orgId: userRoles.orgId })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id))
    expect(grants).toEqual([{ orgId: school.id }])
  })

  it('refuses an invoice whose org is not its student’s org', async () => {
    const school = await makeOrg()
    const student = await makeUser()
    const insert = db.insert(invoices).values({
      userId: student.id,
      orgId: school.id,
      amountCents: 100,
      description: 'x',
      dueDate: '2026-01-01',
    })
    await expect(insert).rejects.toThrow()
  })

  it('refuses a role grant in another org than the user’s', async () => {
    const school = await makeOrg()
    const user = await makeUser()
    await grantRole(user.id, 'teacher')

    const moved = db
      .update(userRoles)
      .set({ orgId: school.id })
      .where(eq(userRoles.userId, user.id))
    await expect(moved).rejects.toThrow()
  })

  it("resolves an invoice's org from its student", async () => {
    const school = await makeOrg()
    const student = await makeUser({ orgId: school.id })
    const [row] = await db
      .insert(invoices)
      .values({
        userId: student.id,
        orgId: orgOfUser(student.id),
        amountCents: 100,
        description: 'x',
        dueDate: '2026-01-01',
      })
      .returning({ orgId: invoices.orgId })
    expect(row.orgId).toBe(school.id)
  })

  it('refuses a class with no org', async () => {
    const insert = db.insert(classes).values({ name: 'x' } as typeof classes.$inferInsert)
    await expect(insert).rejects.toThrow()
    const cls = await makeClass()
    expect(cls.orgId).toBe(DIRECT_ORG_ID)
  })
})
