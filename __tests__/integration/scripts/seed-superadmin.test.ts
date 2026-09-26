import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { roles, userRoles, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { seedSuperadmin } from '@/scripts/seed-superadmin'
import { makeOrg, makeUser, resetDb } from '@/__tests__/helpers/db'

const EMAIL = 'owner@example.com'

beforeEach(async () => {
  await resetDb()
  process.env.SUPERADMIN_EMAIL = EMAIL
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterAll(() => db.$client.end())
afterEach(() => {
  delete process.env.SUPERADMIN_EMAIL
  jest.restoreAllMocks()
})

async function grantsOf(userId: string) {
  const rows = await db
    .select({ role: roles.name, orgId: userRoles.orgId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
  return rows.sort((a, b) => a.role.localeCompare(b.role))
}

const EXPECTED = [
  { role: 'admin', orgId: DIRECT_ORG_ID },
  { role: 'platform_admin', orgId: null },
]

describe('seedSuperadmin', () => {
  it('creates the user in Direct with platform_admin and Direct admin', async () => {
    await seedSuperadmin()
    const [user] = await db.select().from(users).where(eq(users.email, EMAIL))
    expect(user.orgId).toBe(DIRECT_ORG_ID)
    expect(await grantsOf(user.id)).toEqual(EXPECTED)
  })

  it('is idempotent', async () => {
    await seedSuperadmin()
    await seedSuperadmin()
    const [user] = await db.select().from(users).where(eq(users.email, EMAIL))
    expect(await grantsOf(user.id)).toEqual(EXPECTED)
  })

  it('promotes a Direct user who already signed in', async () => {
    const user = await makeUser({ email: EMAIL })
    await seedSuperadmin()
    expect(await grantsOf(user.id)).toEqual(EXPECTED)
  })

  it('refuses a user who belongs to another org', async () => {
    const school = await makeOrg()
    const user = await makeUser({ email: EMAIL, orgId: school.id })
    await expect(seedSuperadmin()).rejects.toThrow(/another org/)
    expect(await grantsOf(user.id)).toEqual([])
  })
})
