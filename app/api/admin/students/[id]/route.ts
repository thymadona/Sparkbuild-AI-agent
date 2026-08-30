import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { studentProfiles } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

// PATCH: update student profile fields (is_active, full_name, parent_email, parent_telegram_chat_id, notes)
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'students:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as Partial<{
    is_active: boolean
    full_name: string
    parent_email: string
    parent_telegram_chat_id: string
    notes: string
  }>

  // Copied field by field rather than handing the parsed body to .set(): the
  // body is caller-controlled, and passing it straight through would also let
  // user_id and created_by be rewritten — reassigning a profile to a different
  // account.
  const updates: Partial<typeof studentProfiles.$inferInsert> = {}
  if (typeof body.is_active === 'boolean') updates.isActive = body.is_active
  if (typeof body.full_name === 'string') updates.fullName = body.full_name
  if (body.parent_email !== undefined) updates.parentEmail = body.parent_email
  if (body.parent_telegram_chat_id !== undefined) {
    updates.parentTelegramChatId = body.parent_telegram_chat_id
  }
  if (body.notes !== undefined) updates.notes = body.notes

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    await db.update(studentProfiles).set(updates).where(eq(studentProfiles.userId, params.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/students/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}
