import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classes } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as Partial<{ name: string; description: string }>

  // Fields are copied across one at a time rather than passing the parsed body
  // to .set() wholesale: the body is caller-controlled, and handing it straight
  // to the query builder lets any column named in it be written.
  const updates: Partial<typeof classes.$inferInsert> = {}
  if (typeof body.name === 'string') updates.name = body.name
  if (body.description !== undefined) updates.description = body.description

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    await db.update(classes).set(updates).where(eq(classes.id, params.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/classes/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to update class' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await db.delete(classes).where(eq(classes.id, params.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/classes/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 })
  }
}
