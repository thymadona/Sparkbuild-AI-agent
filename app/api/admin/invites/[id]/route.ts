import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgInvites } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

// Revokes an open invite of the caller's own org. Kept as history, not
// deleted. Another org's invite answers exactly like a missing one.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'roles:manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const rows = await db
      .update(orgInvites)
      .set({ status: 'revoked', respondedAt: sql`now()` })
      .where(
        and(
          eq(orgInvites.id, params.id),
          eq(orgInvites.orgId, user.orgId),
          eq(orgInvites.status, 'pending')
        )
      )
      .returning({ id: orgInvites.id })
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/invites/[id] failed:', err)
    return NextResponse.json({ error: 'Could not revoke the invite' }, { status: 500 })
  }
}
