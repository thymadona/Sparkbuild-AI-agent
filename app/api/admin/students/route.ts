import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { studentProfiles } from '@/lib/db/schema'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { addPersonToOrg, normalizeEmail } from '@/lib/org-people'
import { CONFLICT_MESSAGE } from '@/lib/platform-orgs'

// Thrown to roll back a grant: this modal creates students, it doesn't turn
// someone already in the org (a teacher, say) into one.
class AlreadyHere extends Error {}

// The "New Student" modal. Goes through addPersonToOrg like every other way
// into an org: a new email is pre-provisioned in the caller's org (claimed by
// signing in with Google on that address), a Direct account gets an invite it
// must accept, and another school's account is refused.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'students:manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, parent_email, parent_telegram_chat_id, notes } = (await req
    .json()
    .catch(() => ({}))) as {
    email?: string
    full_name?: string
    parent_email?: string
    parent_telegram_chat_id?: string
    notes?: string
  }

  const address = normalizeEmail(email)
  const name = typeof full_name === 'string' ? full_name.trim() : ''
  if (!address || !name) {
    return NextResponse.json({ error: 'email and full_name are required' }, { status: 400 })
  }

  try {
    const result = await db.transaction(async (tx) => {
      const person = await addPersonToOrg(tx, {
        orgId: user.orgId,
        email: address,
        name,
        role: 'student',
        invitedBy: user.id,
        parentEmail: parent_email?.trim() || null,
      })
      if (person.kind === 'granted') throw new AlreadyHere()
      // The modal's extra fields belong on a profile this call just made;
      // an existing student's profile is edited from their own page.
      if (person.kind === 'created') {
        await tx
          .update(studentProfiles)
          .set({
            parentTelegramChatId: parent_telegram_chat_id?.trim() || null,
            notes: notes?.trim() || null,
          })
          .where(eq(studentProfiles.userId, person.userId))
      }
      return person
    })

    if (result.kind === 'conflict')
      return NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 })
    if (result.kind === 'invited')
      return NextResponse.json({ status: 'invited', inviteId: result.inviteId })
    return NextResponse.json({ status: 'created', userId: result.userId })
  } catch (err) {
    if (err instanceof AlreadyHere)
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    console.error('POST /api/admin/students failed:', err)
    return NextResponse.json({ error: 'Could not create the student' }, { status: 500 })
  }
}
