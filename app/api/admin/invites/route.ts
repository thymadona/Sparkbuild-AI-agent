import { NextResponse } from 'next/server'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { loadPendingInvites } from '@/lib/org-invites'

// The caller's own org's open invites.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'roles:manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    return NextResponse.json({ invites: await loadPendingInvites(user.orgId) })
  } catch (err) {
    console.error('GET /api/admin/invites failed:', err)
    return NextResponse.json({ error: 'Could not load invites' }, { status: 500 })
  }
}
