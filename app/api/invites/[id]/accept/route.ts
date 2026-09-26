import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/db/uuid'
import { acceptInvite } from '@/lib/org-move'

// Accepts one of the caller's own invites and moves them into that school (lib/org-move.ts).
// Someone else's invite answers like a missing one.
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  try {
    const answer = await acceptInvite(user.id, params.id)
    if (!answer.ok) return NextResponse.json({ error: answer.error }, { status: answer.status })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/invites/[id]/accept failed:', err)
    return NextResponse.json({ error: 'Could not accept the invite' }, { status: 500 })
  }
}
