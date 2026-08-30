import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { CURRENT_LESSON_VERSION } from '@/lib/lessons'
import { classMembers, classes, projects, roles, studentProfiles, userRoles, users } from '@/lib/db/schema'

// Reference data created by drizzle/0001_functions_sequence_seed.sql. The
// authorization functions join through these, so truncating them would make
// every permission check vacuously false instead of exercising the real
// rules. Everything else is test data and goes.
const SEEDED = ['roles', 'permissions', 'role_permissions', '__drizzle_migrations']

/**
 * Empties every table that holds test data. CASCADE handles the FK order for
 * us, so this stays correct as tables are added — the table list is read from
 * the catalog rather than hand-maintained.
 */
export async function resetDb(): Promise<void> {
  const rows = (await db.execute(sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `)) as unknown as { table_name: string }[]

  const targets = rows.map((r) => r.table_name).filter((t) => !SEEDED.includes(t))
  if (targets.length === 0) return

  const list = sql.join(
    targets.map((t) => sql.identifier(t)),
    sql`, `
  )
  await db.execute(sql`truncate table ${list} restart identity cascade`)
}

let seq = 0
const uniq = () => `${Date.now()}-${seq++}`

/** Creates a user row. Email is made unique so callers never collide. */
export async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [row] = await db
    .insert(users)
    .values({
      name: 'Test Student',
      email: `user-${uniq()}@example.test`,
      emailVerified: true,
      ...overrides,
    })
    .returning()
  return row
}

/** Grants a seeded platform role ('admin' | 'teacher') to a user. */
export async function grantRole(userId: string, roleName: 'admin' | 'teacher') {
  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, roleName)).limit(1)
  if (!role) throw new Error(`role "${roleName}" is missing — is drizzle/0001 applied?`)
  await db.insert(userRoles).values({ userId, roleId: role.id }).onConflictDoNothing()
}

export async function makeClass(overrides: Partial<typeof classes.$inferInsert> = {}) {
  const [row] = await db
    .insert(classes)
    .values({ name: `Class ${uniq()}`, ...overrides })
    .returning()
  return row
}

/** Adds a user to a class as a student or teacher. */
export async function addClassMember(classId: string, userId: string, role: 'student' | 'teacher') {
  await db
    .insert(classMembers)
    .values({ classId, userId, role })
    .onConflictDoNothing()
}

export async function makeStudentProfile(userId: string, overrides: Partial<typeof studentProfiles.$inferInsert> = {}) {
  const [row] = await db
    .insert(studentProfiles)
    .values({ userId, fullName: 'Test Student', ...overrides })
    .returning()
  return row
}

/** Creates a project owned by `userId`. Defaults to a lesson-1 project on the
 *  current catalog, which is what the lesson routes expect to find. */
export async function makeProject(
  userId: string,
  overrides: Partial<typeof projects.$inferInsert> = {}
) {
  const [row] = await db
    .insert(projects)
    .values({
      userId,
      title: `Project ${uniq()}`,
      files: { 'index.html': '<!doctype html>' },
      lessonId: 1,
      lessonVersion: CURRENT_LESSON_VERSION,
      ...overrides,
    })
    .returning()
  return row
}
