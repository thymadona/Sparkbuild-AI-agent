import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

function isAdmin(email: string | undefined) {
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email?.toLowerCase() ?? '')
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch invoice
  const { data: invoice, error: fetchErr } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status !== 'unpaid') {
    return NextResponse.json({ error: `Invoice is already ${invoice.status}` }, { status: 400 })
  }

  // Generate receipt number: RCP-YYYY-NNNN
  const { data: seqData, error: seqErr } = await supabaseAdmin
    .rpc('nextval', { seq: 'receipt_number_seq' })

  // Fallback: use timestamp if RPC not available
  const seq = seqErr ? Date.now() : (seqData as number)
  const year = new Date().getFullYear()
  const receiptNumber = `RCP-${year}-${String(seq).padStart(4, '0')}`

  const paidAt = new Date().toISOString()

  // Create immutable receipt snapshot
  const { data: receipt, error: receiptErr } = await supabaseAdmin
    .from('receipts')
    .insert({
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      amount_cents: invoice.amount_cents,
      description: invoice.description,
      paid_at: paidAt,
      receipt_number: receiptNumber,
    })
    .select()
    .single()

  if (receiptErr) return NextResponse.json({ error: receiptErr.message }, { status: 500 })

  // Mark invoice paid
  const { error: updateErr } = await supabaseAdmin
    .from('invoices')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', params.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ receipt_id: receipt.id, receipt_number: receiptNumber })
}
