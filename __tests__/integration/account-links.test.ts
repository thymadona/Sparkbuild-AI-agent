/**
 * getAccountLinks: which back-office links the profile menu shows. They
 * follow the same gates as /staff and /console.
 */
import { getAccountLinks } from '@/lib/account-links'
import { db } from '@/lib/db/client'
import {
  addClassMember,
  grantRole,
  makeClass,
  makeOrg,
  makeUser,
  resetDb,
} from '@/__tests__/helpers/db'

beforeEach(resetDb)
afterAll(() => db.$client.end())

describe('getAccountLinks', () => {
  it('shows a student no links', async () => {
    const student = await makeUser()
    await grantRole(student.id, 'student')
    await expect(getAccountLinks(student.id)).resolves.toEqual({ staff: false, console: false })
  })

  it('links an org admin, including a school admin, to the dashboard', async () => {
    const school = await makeOrg()
    const admin = await makeUser({ orgId: school.id })
    await grantRole(admin.id, 'admin')
    await expect(getAccountLinks(admin.id)).resolves.toEqual({ staff: true, console: false })
  })

  it('links a teacher of a class to the dashboard, but not a teacher with no class', async () => {
    const teacher = await makeUser()
    await grantRole(teacher.id, 'teacher')
    await expect(getAccountLinks(teacher.id)).resolves.toMatchObject({ staff: false })

    const cls = await makeClass()
    await addClassMember(cls.id, teacher.id, 'teacher')
    const other = await makeUser()
    await grantRole(other.id, 'teacher')
    await addClassMember(cls.id, other.id, 'teacher')
    await expect(getAccountLinks(other.id)).resolves.toMatchObject({ staff: true })
  })

  it('links the platform owner to both', async () => {
    const owner = await makeUser()
    await grantRole(owner.id, 'platform_admin')
    await grantRole(owner.id, 'admin')
    await expect(getAccountLinks(owner.id)).resolves.toEqual({ staff: true, console: true })
  })

  it('shows no links when the checks fail', async () => {
    await expect(getAccountLinks('not-a-uuid')).resolves.toEqual({ staff: false, console: false })
  })
})
