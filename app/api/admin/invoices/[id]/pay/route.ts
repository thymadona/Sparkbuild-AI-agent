import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { invoices, receipts } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const paidAt = new Date().toISOString()

  try {
    // One transaction: the receipt is an immutable record that the invoice was
    // paid, so it must not be able to exist beside an invoice still marked
    // unpaid. Previously these were two independent statements and a failure
    // between them left exactly that.
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          userId: invoices.userId,
          amountCents: invoices.amountCents,
          description: invoices.description,
          status: invoices.status,
        })
        .from(invoices)
        .where(eq(invoices.id, params.id))
        .limit(1)

      if (!invoice) return { error: 'Invoice not found', status: 404 } as const
      if (invoice.status !== 'unpaid') {
        return { error: `Invoice is already ${invoice.status}`, status: 400 } as const
      }

      // Receipt numbering: RCP-YYYY-NNNN, from the sequence
      // drizzle/0001_functions_sequence_seed.sql creates. The PostgREST
      // version called `.rpc('nextval', ...)`, which PostgREST does not
      // expose, so it fell through to its `Date.now()` fallback on every
      // call and numbered receipts with a 13-digit epoch.
      const seqRows = (await tx.execute(
        sql`select nextval('receipt_number_seq') as value`
      )) as unknown as { value: string | number }[]

      const seq = seqRows[0].value
      const year = new Date().getFullYear()
      const receiptNumber = `RCP-${year}-${String(seq).padStart(4, '0')}`

      const [receipt] = await tx
        .insert(receipts)
        .values({
          invoiceId: invoice.id,
          userId: invoice.userId,
          amountCents: invoice.amountCents,
          description: invoice.description,
          paidAt,
          receiptNumber,
        })
        .returning({ id: receipts.id })

      await tx
        .update(invoices)
        .set({ status: 'paid', paidAt })
        .where(eq(invoices.id, params.id))

      return { receipt_id: receipt.id, receipt_number: receiptNumber } as const
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/admin/invoices/[id]/pay failed:', err)
    return NextResponse.json({ error: 'Failed to mark invoice paid' }, { status: 500 })
  }
}
