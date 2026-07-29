import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'

function isAdmin(email: string | undefined) {
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email?.toLowerCase() ?? '')
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })

  // Fetch invoice
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', params.id)
    .single()

  if (invErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Fetch student profile for Telegram chat_id and name
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('student_profiles')
    .select('full_name, parent_telegram_chat_id')
    .eq('user_id', invoice.user_id)
    .single()

  if (profErr || !profile) return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
  if (!profile.parent_telegram_chat_id) {
    return NextResponse.json({ error: 'Parent Telegram chat_id not set for this student' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const invoiceUrl = `${baseUrl}/invoice/${invoice.id}`

  // Fetch receipt if paid
  let receiptUrl: string | null = null
  if (invoice.status === 'paid') {
    const { data: receipt } = await supabaseAdmin
      .from('receipts')
      .select('id')
      .eq('invoice_id', invoice.id)
      .maybeSingle()
    if (receipt) receiptUrl = `${baseUrl}/receipt/${receipt.id}`
  }

  const dueDate = new Date(invoice.due_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const statusLine = invoice.status === 'paid'
    ? `✅ *Status:* PAID`
    : `⏳ *Status:* Unpaid — due ${dueDate}`

  const message = [
    `📋 *Invoice for ${profile.full_name}*`,
    ``,
    `*Amount:* ${formatAmount(invoice.amount_cents)}`,
    `*Description:* ${invoice.description}`,
    statusLine,
    `\n📄 [View Invoice](${invoiceUrl})`,
    receiptUrl ? `🧾 [View Receipt](${receiptUrl})` : '',
  ].filter(Boolean).join('\n')

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: profile.parent_telegram_chat_id,
      text: message,
      parse_mode: 'Markdown',
    }),
  })

  const tgData = await tgRes.json() as { ok: boolean; description?: string }
  if (!tgData.ok) {
    return NextResponse.json({ error: tgData.description ?? 'Telegram send failed' }, { status: 500 })
  }

  // Record sent_at
  await supabaseAdmin
    .from('invoices')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', params.id)

  return NextResponse.json({ ok: true })
}
