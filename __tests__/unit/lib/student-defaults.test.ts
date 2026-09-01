import { eq } from 'drizzle-orm'
import { ensureStudentDefaults } from '@/lib/auth/student-defaults'
import { getUserRoles, hasPermission } from '@/lib/auth/permissions'
import { db } from '@/lib/db/client'
import { studentProfiles } from '@/lib/db/schema'
import { grantRole, makeUser, resetDb } from '@/__tests__/helpers/db'

// Runs against the real TEST_DATABASE_URL. This function is called from
// Better Auth's databaseHooks, so the only other way to exercise it would be
// a full OAuth round-trip — which is why it was extracted out of
// lib/auth/index.ts in the first place.
beforeEach(resetDb)
afterAll(() => db.$client.end())

async function profileFor(userId: string) {
  const [row] = await db
    .select({ full_name: studentProfiles.fullName })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1)
  return row ?? null
}

describe('ensureStudentDefaults', () => {
  it('gives a brand-new account both a profile and the student role', async () => {
    const user = await makeUser()
    await ensureStudentDefaults(user.id, 'Ada Lovelace')

    expect(await profileFor(user.id)).toEqual({ full_name: 'Ada Lovelace' })
    await expect(getUserRoles(user.id)).resolves.toEqual(['student'])
  })

  it('is idempotent — the session hook runs it on every sign-in', async () => {
    const user = await makeUser()
    await ensureStudentDefaults(user.id, 'Ada Lovelace')
    await ensureStudentDefaults(user.id, 'Ada Lovelace')
    await ensureStudentDefaults(user.id, 'Ada Lovelace')

    await expect(getUserRoles(user.id)).resolves.toEqual(['student'])
  })

  it('does not clobber an admin’s edits to an existing profile', async () => {
    const user = await makeUser()
    await ensureStudentDefaults(user.id, 'Original Name')
    await db
      .update(studentProfiles)
      .set({ fullName: 'Corrected By Admin' })
      .where(eq(studentProfiles.userId, user.id))

    await ensureStudentDefaults(user.id, 'Original Name')

    expect(await profileFor(user.id)).toEqual({ full_name: 'Corrected By Admin' })
  })

  it('skips admins entirely — no profile, no student role', async () => {
    const user = await makeUser()
    await grantRole(user.id, 'admin')
    await ensureStudentDefaults(user.id, 'Admin Account')

    expect(await profileFor(user.id)).toBeNull()
    await expect(getUserRoles(user.id)).resolves.toEqual(['admin'])
  })

  it('skips teachers entirely — no profile, no student role', async () => {
    const user = await makeUser()
    await grantRole(user.id, 'teacher')
    await ensureStudentDefaults(user.id, 'Teacher Account')

    expect(await profileFor(user.id)).toBeNull()
    await expect(getUserRoles(user.id)).resolves.toEqual(['teacher'])
  })

  it('leaves both rows in place when a student is promoted to teacher', async () => {
    // Roles are additive: the staff pages filter on STAFF_ROLES rather than
    // revoking, so a promoted account legitimately holds student + teacher.
    const user = await makeUser()
    await ensureStudentDefaults(user.id, 'Promoted')
    await grantRole(user.id, 'teacher')

    await expect(getUserRoles(user.id)).resolves.toEqual(
      expect.arrayContaining(['student', 'teacher'])
    )

    // And the next sign-in must not re-add or duplicate anything.
    await ensureStudentDefaults(user.id, 'Promoted')
    const after = await getUserRoles(user.id)
    expect(after).toHaveLength(2)
  })
})

describe('the student role carries no permissions', () => {
  it.each([
    'invoices:manage',
    'classes:manage',
    'students:manage',
    'homework:review',
    'students:message',
    'telegram:manage',
    'roles:manage',
  ])('denies %s', async (key) => {
    const user = await makeUser()
    await ensureStudentDefaults(user.id, 'Student')
    await expect(hasPermission(user.id, key)).resolves.toBe(false)
  })
})
