import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classEnabledLessons } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission, isTeacherOfClass } from '@/lib/auth/permissions'
import { LESSONS } from '@/lib/lessons'
import { getSessionUser } from '@/lib/auth/session'

// Toggles a lesson week on/off for one class. isTeacherOfClass is already
// admin-inclusive (see public.is_teacher_of_class in
// drizzle/0001_functions_sequence_seed.sql), so this one
// check covers both "admin managing any class" and "the teacher(s) of this
// specific class" — the same two callers who reach /staff/classes/[id].
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = (await hasPermission(user.id, 'classes:manage')) || (await isTeacherOfClass(user.id, params.id))
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { lessonId?: number; enabled?: boolean }
  const { lessonId, enabled } = body

  if (typeof lessonId !== 'number' || !LESSONS.some((l) => l.id === lessonId)) {
    return NextResponse.json({ error: 'lessonId must match a lesson in the catalog' }, { status: 400 })
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  try {
    if (enabled) {
      await db
        .insert(classEnabledLessons)
        .values({ classId: params.id, lessonId, enabledBy: user.id })
        .onConflictDoUpdate({
          target: [classEnabledLessons.classId, classEnabledLessons.lessonId],
          set: { enabledBy: user.id },
        })
    } else {
      await db
        .delete(classEnabledLessons)
        .where(
          and(
            eq(classEnabledLessons.classId, params.id),
            eq(classEnabledLessons.lessonId, lessonId)
          )
        )
    }
  } catch (err) {
    console.error('POST /api/admin/classes/[id]/lessons failed:', err)
    return NextResponse.json({ error: 'Failed to update lesson access' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
