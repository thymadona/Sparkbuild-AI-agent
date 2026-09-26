import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/db/uuid'
import { declineInvite } from '@/lib/org-move'

// Declines one of the caller's own invites.
// Someone else's invite answers like a missing one.
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  try {
    const answer = await declineInvite(user.id, params.id)
    if (!answer.ok) return NextResponse.json({ error: answer.error }, { status: answer.status })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/invites/[id]/decline failed:', err)
    return NextResponse.json({ error: 'Could not decline the invite' }, { status: 500 })
  }
}
