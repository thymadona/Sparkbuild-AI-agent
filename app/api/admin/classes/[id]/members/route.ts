import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userId, role } = await req.json() as { userId: string; role?: 'student' | 'teacher' }
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (!isUuid(userId)) return NextResponse.json({ error: 'userId is not a valid id' }, { status: 400 })
  if (role && role !== 'student' && role !== 'teacher') {
    return NextResponse.json({ error: 'role must be student or teacher' }, { status: 400 })
  }

  // Upsert rather than insert: re-adding an existing member (e.g. flipping
  // a teacher back to a student, or vice versa) updates the role in place
  // instead of erroring on the composite (class_id, user_id) primary key.
  try {
    await db
      .insert(classMembers)
      .values({ classId: params.id, userId, role: role ?? 'student' })
      .onConflictDoUpdate({
        target: [classMembers.classId, classMembers.userId],
        set: { role: role ?? 'student' },
      })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/classes/[id]/members failed:', err)
    return NextResponse.json({ error: 'Failed to update class membership' }, { status: 500 })
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (!isUuid(userId)) return NextResponse.json({ error: 'userId is not a valid id' }, { status: 400 })

  try {
    await db
      .delete(classMembers)
      .where(and(eq(classMembers.classId, params.id), eq(classMembers.userId, userId)))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/classes/[id]/members failed:', err)
    return NextResponse.json({ error: 'Failed to remove class member' }, { status: 500 })
  }
}
