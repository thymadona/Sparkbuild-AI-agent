import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, classes, roles, userRoles, users } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { STAFF_ROLES, hasPermission, isTeacherOfClass } from '@/lib/auth/permissions'
import { getSessionUser, type SessionUser } from '@/lib/auth/session'
import { classInOrg, usersInOrg } from '@/lib/orgs'

// Two kinds of caller may change a class's roster: a classes:manage holder
// (any member, any class of their org), or a teacher of this class (student
// members only). Returns whether the caller is the first kind, or the
// response to send. Another org's class answers 404 either way.
async function rosterAccess(
  user: SessionUser,
  classId: string
): Promise<{ manager: boolean } | NextResponse> {
  if (await hasPermission(user.id, 'classes:manage')) return { manager: true }
  if (await isTeacherOfClass(user.id, classId)) return { manager: false }
  return (await classInOrg(classId, user.orgId))
    ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// True if the user is a student of this org and nothing more. Roles are
// additive, so a promoted student also holding teacher or admin is staff, and
// a teacher may not move them. Throws on a database error.
async function isStudentOnly(userId: string, orgId: string): Promise<boolean> {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(userRoles.orgId, orgId)))
  const names = rows.map((r) => r.name)
  return (
    names.includes('student') && !names.some((n) => (STAFF_ROLES as readonly string[]).includes(n))
  )
}

const ONLY_STUDENTS = 'Teachers can add or remove only students'

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userId, role } = (await req.json()) as { userId: string; role?: 'student' | 'teacher' }
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (!isUuid(userId))
    return NextResponse.json({ error: 'userId is not a valid id' }, { status: 400 })
  if (role && role !== 'student' && role !== 'teacher') {
    return NextResponse.json({ error: 'role must be student or teacher' }, { status: 400 })
  }

  // Upsert rather than insert: re-adding an existing member (e.g. flipping
  // a teacher back to a student, or vice versa) updates the role in place
  // instead of erroring on the composite (class_id, user_id) primary key.
  try {
    const access = await rosterAccess(user, params.id)
    if (access instanceof NextResponse) return access

    // class_members has no FK tying a member to the class's org, so this is
    // the check: the class and the user must both be in the caller's org.
    const [both] = await db
      .select({ id: classes.id })
      .from(classes)
      .innerJoin(users, eq(users.orgId, classes.orgId))
      .where(and(eq(classes.id, params.id), eq(classes.orgId, user.orgId), eq(users.id, userId)))
      .limit(1)
    if (!both) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!access.manager && (role === 'teacher' || !(await isStudentOnly(userId, user.orgId))))
      return NextResponse.json({ error: ONLY_STUDENTS }, { status: 403 })

    await db
      .insert(classMembers)
      .values({ classId: params.id, userId, role: role ?? 'student' })
      .onConflictDoUpdate({
        target: [classMembers.classId, classMembers.userId],
        set: { role: role ?? 'student' },
      })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/classes/[id]/members failed:', err)
    return NextResponse.json({ error: 'Failed to update class membership' }, { status: 500 })
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (!isUuid(userId))
    return NextResponse.json({ error: 'userId is not a valid id' }, { status: 400 })

  try {
    const access = await rosterAccess(user, params.id)
    if (access instanceof NextResponse) return access
    if (!(await classInOrg(params.id, user.orgId)))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!access.manager) {
      const [member] = await db
        .select({ role: classMembers.role })
        .from(classMembers)
        .where(
          and(
            eq(classMembers.classId, params.id),
            eq(classMembers.userId, userId),
            inArray(classMembers.userId, usersInOrg(user.orgId))
          )
        )
        .limit(1)
      if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (member.role !== 'student' || !(await isStudentOnly(userId, user.orgId)))
        return NextResponse.json({ error: ONLY_STUDENTS }, { status: 403 })
    }

    await db
      .delete(classMembers)
      .where(and(eq(classMembers.classId, params.id), eq(classMembers.userId, userId)))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/classes/[id]/members failed:', err)
    return NextResponse.json({ error: 'Failed to remove class member' }, { status: 500 })
  }
}
