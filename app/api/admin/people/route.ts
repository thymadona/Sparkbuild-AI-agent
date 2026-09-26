import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import {
  addPersonToOrg,
  isStaffAddableRole,
  normalizeEmail,
  permissionForRole,
} from '@/lib/org-people'
import { CONFLICT_MESSAGE, personResponse } from '@/lib/platform-orgs'

// Adds one student or teacher to the caller's own org by email. The org is
// always the session's, never the body's, so an admin can't write to another
// org. addPersonToOrg decides the outcome: a new email is pre-provisioned, an
// email already here gets the role, a Direct account gets an invite it must
// accept, and another school's account is refused.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const role = body.role
  if (!isStaffAddableRole(role))
    return NextResponse.json({ error: 'role must be student or teacher' }, { status: 400 })
  if (!(await hasPermission(user.id, permissionForRole(role))))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = normalizeEmail(body.email)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const rawParent = typeof body.parentEmail === 'string' ? body.parentEmail.trim() : ''
  const parentEmail = rawParent ? normalizeEmail(rawParent) : null
  if (!email) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
  if (rawParent && !parentEmail)
    return NextResponse.json({ error: 'The parent email is not valid' }, { status: 400 })

  try {
    const result = await db.transaction((tx) =>
      addPersonToOrg(tx, {
        orgId: user.orgId,
        email,
        name,
        role,
        invitedBy: user.id,
        parentEmail: role === 'student' ? parentEmail : null,
      })
    )
    if (result.kind === 'conflict')
      return NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 })
    return NextResponse.json(personResponse(result))
  } catch (err) {
    console.error('POST /api/admin/people failed:', err)
    return NextResponse.json({ error: 'Could not add that person' }, { status: 500 })
  }
}
