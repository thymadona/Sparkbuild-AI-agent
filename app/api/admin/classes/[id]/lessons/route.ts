import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classEnabledLessons } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission, isTeacherOfClass } from '@/lib/auth/permissions'
import { LESSONS } from '@/lib/lessons'
import { getSessionUser } from '@/lib/auth/session'
import { classInOrg } from '@/lib/orgs'

// Toggles a lesson week on/off for one class, for a `classes:manage` holder or
// a teacher of this class — the same two callers who reach
// /staff/classes/[id]. The class must be in the caller's org first:
// hasPermission is org-wide, so without that check a manager could unlock
// lessons in another org's class.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    if (!(await classInOrg(params.id, user.orgId)))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    console.error('POST /api/admin/classes/[id]/lessons failed:', err)
    return NextResponse.json({ error: 'Failed to update lesson access' }, { status: 500 })
  }

  const allowed =
    (await hasPermission(user.id, 'classes:manage')) || (await isTeacherOfClass(user.id, params.id))
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { lessonId?: number; enabled?: boolean }
  const { lessonId, enabled } = body

  if (typeof lessonId !== 'number' || !LESSONS.some((l) => l.id === lessonId)) {
    return NextResponse.json(
      { error: 'lessonId must match a lesson in the catalog' },
      { status: 400 }
    )
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
