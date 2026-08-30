import {
  getUserRoles,
  hasPermission,
  isAdmin,
  isTeacher,
  requirePermission,
  isTeacherOfClass,
  getTeacherClassIds,
  ForbiddenError,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db/client'
import { addClassMember, grantRole, makeClass, makeUser, resetDb } from '@/__tests__/helpers/db'

// These run against the real TEST_DATABASE_URL rather than a mocked query
// builder. The rules under test live in Postgres security-definer functions
// (drizzle/0001_functions_sequence_seed.sql), so a mock could only assert
// that we called them — not that they answer correctly. The previous version
// of this file stubbed the PostgREST wire shape, which no longer exists.
beforeEach(resetDb)
afterAll(() => db.$client.end())

describe('hasPermission', () => {
  it('grants a permission that the user’s role actually carries', async () => {
    const user = await makeUser()
    await grantRole(user.id, 'admin')
    await expect(hasPermission(user.id, 'invoices:manage')).resolves.toBe(true)
  })

  it('denies a permission the user’s role does not carry', async () => {
    const user = await makeUser()
    await grantRole(user.id, 'teacher')
    // The teacher role is seeded with homework:review and students:message only.
    await expect(hasPermission(user.id, 'invoices:manage')).resolves.toBe(false)
    await expect(hasPermission(user.id, 'homework:review')).resolves.toBe(true)
  })

  it('denies a user with no roles at all', async () => {
    const user = await makeUser()
    await expect(hasPermission(user.id, 'invoices:manage')).resolves.toBe(false)
  })

  it('fails closed (denies) when the query throws', async () => {
    // A malformed uuid makes the cast in the query throw, standing in for any
    // database-level failure. Drizzle throws where Supabase returned
    // `{ error }`, so this is the path that must not escape as an exception.
    await expect(hasPermission('not-a-uuid', 'invoices:manage')).resolves.toBe(false)
  })
})

describe('isAdmin', () => {
  it('is true for an admin and false for a teacher', async () => {
    const admin = await makeUser()
    const teacher = await makeUser()
    await grantRole(admin.id, 'admin')
    await grantRole(teacher.id, 'teacher')

    await expect(isAdmin(admin.id)).resolves.toBe(true)
    await expect(isAdmin(teacher.id)).resolves.toBe(false)
  })

  it('fails closed (denies) when the query throws', async () => {
    await expect(isAdmin('not-a-uuid')).resolves.toBe(false)
  })
})

describe('isTeacher', () => {
  it('is true for the teacher role regardless of class membership', async () => {
    const user = await makeUser()
    await grantRole(user.id, 'teacher')
    await expect(isTeacher(user.id)).resolves.toBe(true)
  })

  it('is false for a plain student', async () => {
    const user = await makeUser()
    await expect(isTeacher(user.id)).resolves.toBe(false)
  })
})

describe('requirePermission', () => {
  it('resolves when the permission is granted', async () => {
    const user = await makeUser()
    await grantRole(user.id, 'admin')
    await expect(requirePermission(user.id, 'classes:manage')).resolves.toBeUndefined()
  })

  it('rejects with ForbiddenError when the permission is denied', async () => {
    const user = await makeUser()
    await expect(requirePermission(user.id, 'classes:manage')).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('rejects with ForbiddenError (fail closed) when the query throws', async () => {
    await expect(requirePermission('not-a-uuid', 'classes:manage')).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('isTeacherOfClass', () => {
  it('is true for the teacher of that specific class only', async () => {
    const teacher = await makeUser()
    const mine = await makeClass()
    const theirs = await makeClass()
    await addClassMember(mine.id, teacher.id, 'teacher')

    await expect(isTeacherOfClass(teacher.id, mine.id)).resolves.toBe(true)
    await expect(isTeacherOfClass(teacher.id, theirs.id)).resolves.toBe(false)
  })

  it('is true for an admin on any class', async () => {
    const admin = await makeUser()
    await grantRole(admin.id, 'admin')
    const someClass = await makeClass()
    await expect(isTeacherOfClass(admin.id, someClass.id)).resolves.toBe(true)
  })

  it('is false for a student member of the class', async () => {
    const student = await makeUser()
    const someClass = await makeClass()
    await addClassMember(someClass.id, student.id, 'student')
    await expect(isTeacherOfClass(student.id, someClass.id)).resolves.toBe(false)
  })

  it('fails closed (denies) when the query throws', async () => {
    await expect(isTeacherOfClass('not-a-uuid', 'also-not-a-uuid')).resolves.toBe(false)
  })
})

describe('getUserRoles', () => {
  it('returns every role name held by the user', async () => {
    const user = await makeUser()
    await grantRole(user.id, 'admin')
    await grantRole(user.id, 'teacher')
    await expect(getUserRoles(user.id)).resolves.toEqual(expect.arrayContaining(['admin', 'teacher']))
  })

  it('returns an empty list for a user with no roles', async () => {
    const user = await makeUser()
    await expect(getUserRoles(user.id)).resolves.toEqual([])
  })

  it('throws (does not fail open) when the query fails', async () => {
    await expect(getUserRoles('not-a-uuid')).rejects.toBeTruthy()
  })
})

describe('getTeacherClassIds', () => {
  it('returns only classes where the user is a teacher, not a student', async () => {
    const user = await makeUser()
    const teaching = await makeClass()
    const attending = await makeClass()
    await addClassMember(teaching.id, user.id, 'teacher')
    await addClassMember(attending.id, user.id, 'student')

    await expect(getTeacherClassIds(user.id)).resolves.toEqual([teaching.id])
  })

  it('throws (does not fail open) when the query fails', async () => {
    await expect(getTeacherClassIds('not-a-uuid')).rejects.toBeTruthy()
  })
})
