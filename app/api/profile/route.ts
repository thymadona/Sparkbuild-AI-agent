import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { studentProfiles, users } from '@/lib/db/schema'

// PATCH /api/profile — rename yourself.
//
// Replaces the old client-side `supabase.auth.updateUser({ data: { full_name } })`,
// which wrote to OAuth metadata that nothing staff-facing ever read — so a
// student renaming themselves stayed invisible to every teacher and admin.
export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''

  if (!fullName) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
  }
  if (fullName.length > 100) {
    return NextResponse.json({ error: 'full_name is too long' }, { status: 400 })
  }

  try {
    // Scoped to the session's own id — never to an id taken from the body.
    await db.transaction(async (tx) => {
      await tx.update(users).set({ name: fullName }).where(eq(users.id, user.id))
      await tx
        .insert(studentProfiles)
        .values({ userId: user.id, fullName })
        .onConflictDoUpdate({ target: studentProfiles.userId, set: { fullName } })
    })
  } catch (err) {
    console.error('PATCH /api/profile failed:', err)
    return NextResponse.json({ error: 'Could not save your name' }, { status: 500 })
  }

  return NextResponse.json({ full_name: fullName })
}
