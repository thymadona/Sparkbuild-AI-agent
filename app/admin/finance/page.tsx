import { supabaseAdmin } from '@/lib/supabase-server'
import FinanceClient from './FinanceClient'

export default async function FinancePage() {
  const [
    { data: invoices },
    { data: profiles },
    { data: receipts },
  ] = await Promise.all([
    supabaseAdmin.from('invoices').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('student_profiles').select('user_id, full_name, parent_telegram_chat_id'),
    supabaseAdmin.from('receipts').select('invoice_id, id'),
  ])

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p])
  )
  const receiptByInvoice = Object.fromEntries(
    (receipts ?? []).map((r) => [r.invoice_id, r.id])
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Finance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Invoices, payments, and receipts</p>
      </div>
      <FinanceClient
        invoices={(invoices ?? []) as Parameters<typeof FinanceClient>[0]['invoices']}
        profileMap={profileMap as Parameters<typeof FinanceClient>[0]['profileMap']}
        receiptByInvoice={receiptByInvoice}
      />
    </div>
  )
}
