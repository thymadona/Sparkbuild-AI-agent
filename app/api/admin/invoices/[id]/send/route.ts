import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { invoices, receipts, studentProfiles } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'invoices:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })

  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // The invoice and the parent's chat id, in one join rather than two round
  // trips. A student with no profile row yields no rows at all, which is the
  // same "profile not found" answer the second query used to give.
  const [row] = await db
    .select({
      id: invoices.id,
      user_id: invoices.userId,
      amount_cents: invoices.amountCents,
      description: invoices.description,
      due_date: invoices.dueDate,
      status: invoices.status,
      full_name: studentProfiles.fullName,
      parent_telegram_chat_id: studentProfiles.parentTelegramChatId,
    })
    .from(invoices)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, invoices.userId))
    .where(eq(invoices.id, params.id))
    .limit(1)

  if (!row) {
    // Distinguish the two, so an admin is told which thing is missing.
    const [invoiceOnly] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, params.id))
      .limit(1)

    return invoiceOnly
      ? NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
      : NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const invoice = row
  const profile = row
  if (!profile.parent_telegram_chat_id) {
    return NextResponse.json({ error: 'Parent Telegram chat_id not set for this student' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const invoiceUrl = `${baseUrl}/invoice/${invoice.id}`

  // Fetch receipt if paid
  let receiptUrl: string | null = null
  if (invoice.status === 'paid') {
    const [receipt] = await db
      .select({ id: receipts.id })
      .from(receipts)
      .where(eq(receipts.invoiceId, invoice.id))
      .limit(1)

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

  // Record sent_at. The message is already delivered at this point, so a
  // failure here is logged rather than reported as a failed send.
  try {
    await db
      .update(invoices)
      .set({ sentAt: new Date().toISOString() })
      .where(eq(invoices.id, params.id))
  } catch (err) {
    console.error('invoice sent but sent_at not recorded:', err)
  }

  return NextResponse.json({ ok: true })
}
