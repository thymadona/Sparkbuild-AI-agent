import { supabaseAdmin } from '@/lib/supabase-server'
import MarkPaidButton from '@/components/admin/MarkPaidButton'
import SendInvoiceButton from '@/components/admin/SendInvoiceButton'

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default async function FinanceTab() {
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

  const unpaidCount = (invoices ?? []).filter((i) => i.status === 'unpaid').length
  const totalOutstanding = (invoices ?? [])
    .filter((i) => i.status === 'unpaid')
    .reduce((s, i) => s + i.amount_cents, 0)
  const totalCollected = (invoices ?? [])
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amount_cents, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-2xl font-bold text-red-400">{formatAmount(totalOutstanding)}</div>
          <div className="mt-1 text-xs text-gray-500">{unpaidCount} unpaid invoices</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-2xl font-bold text-green-400">{formatAmount(totalCollected)}</div>
          <div className="mt-1 text-xs text-gray-500">collected</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-2xl font-bold">{(invoices ?? []).length}</div>
          <div className="mt-1 text-xs text-gray-500">total invoices</div>
        </div>
      </div>

      {/* Invoice table */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Student</th>
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Description</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Amount</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Due</th>
              <th className="text-center px-4 py-3 text-gray-500 font-normal">Status</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).map((inv, i) => {
              const profile = profileMap[inv.user_id]
              const receiptId = receiptByInvoice[inv.id] ?? null
              return (
                <tr key={inv.id} className={i < (invoices ?? []).length - 1 ? 'border-b border-gray-800' : ''}>
                  <td className="px-4 py-3 font-medium">
                    {profile?.full_name ?? <span className="text-gray-600">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{inv.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatAmount(inv.amount_cents)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      inv.status === 'paid'
                        ? 'bg-green-950 border border-green-800 text-green-300'
                        : inv.status === 'void'
                        ? 'bg-gray-800 text-gray-500'
                        : 'bg-red-950 border border-red-800 text-red-300'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end items-center gap-2">
                      {inv.status === 'unpaid' && (
                        <MarkPaidButton invoiceId={inv.id} />
                      )}
                      {receiptId && (
                        <a
                          href={`/receipt/${receiptId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600"
                        >
                          Receipt
                        </a>
                      )}
                      <SendInvoiceButton
                        invoiceId={inv.id}
                        receiptId={receiptId}
                        hasTelegramId={!!profile?.parent_telegram_chat_id}
                      />
                      {inv.sent_at && (
                        <span className="text-xs text-gray-600" title={`Sent ${new Date(inv.sent_at).toLocaleString()}`}>
                          ✓ sent
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {(invoices ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-600">No invoices yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
