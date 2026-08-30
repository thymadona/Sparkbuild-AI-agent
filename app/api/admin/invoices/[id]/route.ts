import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { invoices } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const body = await req.json() as Partial<{
    amount_cents: number
    description: string
    due_date: string
  }>

  // Only the three fields the edit modal sends. The parsed body used to be
  // handed to .update() wholesale, which also accepted `status` — so an
  // invoice could be marked paid here, skipping the receipt that
  // /invoices/[id]/pay exists to create.
  const updates: Partial<typeof invoices.$inferInsert> = {}
  if (typeof body.amount_cents === 'number') updates.amountCents = body.amount_cents
  if (typeof body.description === 'string') updates.description = body.description
  if (typeof body.due_date === 'string') updates.dueDate = body.due_date

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    // Prevent editing paid invoices
    const [existing] = await db
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, params.id))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status === 'paid') {
      return NextResponse.json({ error: 'Cannot edit a paid invoice' }, { status: 400 })
    }

    await db.update(invoices).set(updates).where(eq(invoices.id, params.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/invoices/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  try {
    const [existing] = await db
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, params.id))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status === 'paid') {
      return NextResponse.json({ error: 'Cannot delete a paid invoice' }, { status: 400 })
    }

    await db.delete(invoices).where(eq(invoices.id, params.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/invoices/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
