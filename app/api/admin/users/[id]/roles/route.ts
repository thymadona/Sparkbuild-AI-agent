import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { userRoles, users } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission, roleIdByName } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

interface Props {
  params: Promise<{ id: string }>
}

// 'student' is deliberately NOT assignable. It is granted by
// lib/auth/student-defaults.ts on every non-staff sign-in and shown as a
// read-only badge in /staff/users — hand-revoking a role the auth hook
// re-grants on the next sign-in would just desync the UI from reality.
// Nor is 'platform_admin': it is org-less, and only scripts/seed-superadmin.ts
// grants it.
const ASSIGNABLE_ROLES = ['admin', 'teacher']

// Roles are per org, and an admin manages only their own org's users. A user
// in another org answers exactly like one that does not exist.
async function inCallerOrg(userId: string, orgId: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
    .limit(1)
  return rows.length > 0
}

export async function POST(req: Request, props: Props) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'roles:manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Unknown user' }, { status: 400 })

  const { role } = (await req.json().catch(() => ({}))) as { role?: string }
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'role must be admin or teacher' }, { status: 400 })
  }

  try {
    if (!(await inCallerOrg(params.id, user.orgId))) {
      return NextResponse.json({ error: 'Unknown user' }, { status: 404 })
    }
    const roleId = await roleIdByName(role)
    if (!roleId) return NextResponse.json({ error: 'Unknown role' }, { status: 400 })

    // Re-granting a role a user already holds is a no-op, not an error on the
    // composite (user_id, role_id) primary key.
    await db
      .insert(userRoles)
      .values({ userId: params.id, roleId, orgId: user.orgId, grantedBy: user.id })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/users/[id]/roles failed:', err)
    return NextResponse.json({ error: 'Failed to grant role' }, { status: 500 })
  }
}

export async function DELETE(req: Request, props: Props) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'roles:manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Unknown user' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'role must be admin or teacher' }, { status: 400 })
  }
  // Lockout safeguard: an admin can't revoke their own admin role.
  if (role === 'admin' && params.id === user.id) {
    return NextResponse.json({ error: 'Cannot revoke your own admin role' }, { status: 400 })
  }

  try {
    if (!(await inCallerOrg(params.id, user.orgId))) {
      return NextResponse.json({ error: 'Unknown user' }, { status: 404 })
    }
    const roleId = await roleIdByName(role)
    if (!roleId) return NextResponse.json({ error: 'Unknown role' }, { status: 400 })

    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, params.id),
          eq(userRoles.roleId, roleId),
          eq(userRoles.orgId, user.orgId)
        )
      )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/users/[id]/roles failed:', err)
    return NextResponse.json({ error: 'Failed to revoke role' }, { status: 500 })
  }
}
