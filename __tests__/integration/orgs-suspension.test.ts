/**
 * isSuspendedFor: who a suspended org pauses. getSessionUser and proxy.ts
 * both ask it, so this is the rule behind "every member is paused".
 */
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { organizations, projects } from '@/lib/db/schema'
import { DIRECT_ORG_ID, isSuspendedFor } from '@/lib/orgs'
import { grantRole, makeOrg, makeProject, makeUser, resetDb } from '@/__tests__/helpers/db'

beforeEach(resetDb)
afterAll(() => db.$client.end())

const setStatus = (id: string, status: 'active' | 'suspended') =>
  db.update(organizations).set({ status }).where(eq(organizations.id, id))

describe('isSuspendedFor', () => {
  it('never pauses a SparkBuild Direct user', async () => {
    const user = await makeUser()
    await expect(isSuspendedFor(user.id, DIRECT_ORG_ID)).resolves.toBe(false)
  })

  it('pauses every member of a suspended school, admin included', async () => {
    const school = await makeOrg()
    const student = await makeUser({ orgId: school.id })
    const admin = await makeUser({ orgId: school.id })
    await grantRole(admin.id, 'admin')
    await setStatus(school.id, 'suspended')

    await expect(isSuspendedFor(student.id, school.id)).resolves.toBe(true)
    await expect(isSuspendedFor(admin.id, school.id)).resolves.toBe(true)
  })

  it('does not pause an active school', async () => {
    const school = await makeOrg()
    const student = await makeUser({ orgId: school.id })
    await expect(isSuspendedFor(student.id, school.id)).resolves.toBe(false)
  })

  it('never pauses the platform owner', async () => {
    const school = await makeOrg()
    const owner = await makeUser({ orgId: school.id })
    await grantRole(owner.id, 'platform_admin')
    await setStatus(school.id, 'suspended')
    await expect(isSuspendedFor(owner.id, school.id)).resolves.toBe(false)
  })

  it('keeps the data: after reactivation the student is back with their projects', async () => {
    const school = await makeOrg()
    const student = await makeUser({ orgId: school.id })
    const project = await makeProject(student.id)

    await setStatus(school.id, 'suspended')
    await setStatus(school.id, 'active')

    await expect(isSuspendedFor(student.id, school.id)).resolves.toBe(false)
    const rows = await db.select().from(projects).where(eq(projects.id, project.id))
    expect(rows).toHaveLength(1)
  })

  it('throws on a database error, so the caller can fail closed', async () => {
    await expect(isSuspendedFor('not-a-uuid', 'not-a-uuid')).rejects.toThrow()
  })
})
