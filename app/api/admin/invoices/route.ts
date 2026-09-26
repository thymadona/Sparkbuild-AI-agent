import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { invoices, users } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

// snake_case keys: `Invoice` in types/index.ts, the finance views and the
// invoice modals all read this shape directly.
const invoiceColumns = {
  id: invoices.id,
  user_id: invoices.userId,
  amount_cents: invoices.amountCents,
  description: invoices.description,
  due_date: invoices.dueDate,
  status: invoices.status,
  sent_at: invoices.sentAt,
  paid_at: invoices.paidAt,
  created_at: invoices.createdAt,
  org_id: invoices.orgId,
}

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (userId && !isUuid(userId)) return NextResponse.json([])

  try {
    const rows = await db
      .select(invoiceColumns)
      .from(invoices)
      .where(and(eq(invoices.orgId, user.orgId), userId ? eq(invoices.userId, userId) : undefined))
      .orderBy(desc(invoices.createdAt))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/admin/invoices failed:', err)
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, amount_cents, description, due_date } = (await req.json()) as {
    user_id: string
    amount_cents: number
    description: string
    due_date: string
  }

  if (!user_id || !amount_cents || !description || !due_date) {
    return NextResponse.json(
      { error: 'user_id, amount_cents, description, due_date are required' },
      { status: 400 }
    )
  }
  if (!isUuid(user_id)) {
    return NextResponse.json({ error: 'user_id is not a valid id' }, { status: 400 })
  }

  try {
    // Only a student in the caller's org can be billed. The composite FK
    // (user_id, org_id) → users(id, org_id) backs this up: an invoice stamped
    // with the caller's org cannot point at another org's user.
    const [student] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, user_id), eq(users.orgId, user.orgId)))
      .limit(1)
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const [row] = await db
      .insert(invoices)
      .values({
        userId: user_id,
        orgId: user.orgId,
        amountCents: amount_cents,
        description,
        dueDate: due_date,
      })
      .returning(invoiceColumns)

    return NextResponse.json(row)
  } catch (err) {
    // The amount_cents > 0 CHECK constraint lands here too, so the message
    // stays generic rather than guessing which failure it was.
    console.error('POST /api/admin/invoices failed:', err)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
