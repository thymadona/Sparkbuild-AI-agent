import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { loadMyInvites } from '@/lib/org-invites'

// The caller's own open invites to join a school.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ invites: await loadMyInvites(user) })
  } catch (err) {
    console.error('GET /api/invites failed:', err)
    return NextResponse.json({ error: 'Could not load your invites' }, { status: 500 })
  }
}
