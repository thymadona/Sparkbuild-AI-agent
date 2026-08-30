import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classSchedules } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

// snake_case keys: `ClassSchedule` in types/index.ts and the schedule editor
// read this shape directly.
const scheduleColumns = {
  id: classSchedules.id,
  class_id: classSchedules.classId,
  day_of_week: classSchedules.dayOfWeek,
  start_time: classSchedules.startTime,
  duration_min: classSchedules.durationMin,
  label: classSchedules.label,
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { class_id, day_of_week, start_time, duration_min, label } =
    await req.json() as {
      class_id: string
      day_of_week: number
      start_time: string
      duration_min?: number
      label?: string
    }

  if (!class_id || day_of_week == null || !start_time) {
    return NextResponse.json({ error: 'class_id, day_of_week, start_time are required' }, { status: 400 })
  }
  if (!isUuid(class_id)) {
    return NextResponse.json({ error: 'class_id is not a valid id' }, { status: 400 })
  }

  try {
    const [row] = await db
      .insert(classSchedules)
      .values({
        classId: class_id,
        dayOfWeek: day_of_week,
        startTime: start_time,
        durationMin: duration_min ?? 60,
        label: label ?? null,
      })
      .returning(scheduleColumns)

    return NextResponse.json(row)
  } catch (err) {
    // The day_of_week 0-6 CHECK constraint lands here as well as a genuine
    // failure, so the message stays generic rather than guessing which.
    console.error('POST /api/admin/schedules failed:', err)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as Partial<{
    day_of_week: number
    start_time: string
    duration_min: number
    label: string
  }>

  // Copied field by field rather than passing the parsed body to .set(): the
  // body is caller-controlled, and handing it straight to the query builder
  // lets any column named in it be written — class_id included, which would
  // move a schedule to another class.
  const updates: Partial<typeof classSchedules.$inferInsert> = {}
  if (typeof body.day_of_week === 'number') updates.dayOfWeek = body.day_of_week
  if (typeof body.start_time === 'string') updates.startTime = body.start_time
  if (typeof body.duration_min === 'number') updates.durationMin = body.duration_min
  if (body.label !== undefined) updates.label = body.label

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    await db.update(classSchedules).set(updates).where(eq(classSchedules.id, id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/schedules failed:', err)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await db.delete(classSchedules).where(eq(classSchedules.id, id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/schedules failed:', err)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
