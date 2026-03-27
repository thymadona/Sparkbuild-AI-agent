'use client'

import { useState, useMemo } from 'react'
import MarkPaidButton from '@/components/admin/MarkPaidButton'
import SendInvoiceButton from '@/components/admin/SendInvoiceButton'
import EditInvoiceModal from '@/components/admin/EditInvoiceModal'
import DeleteInvoiceButton from '@/components/admin/DeleteInvoiceButton'

type InvoiceRow = {
  id: string
  user_id: string
  amount_cents: number
  description: string
  due_date: string
  status: 'unpaid' | 'paid' | 'void'
  sent_at: string | null
  paid_at: string | null
}

type ProfileRow = {
  user_id: string
  full_name: string
  parent_telegram_chat_id: string | null
}

function formatAmount(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

type Filter = 'all' | 'unpaid' | 'paid' | 'void'

export default function FinanceClient({
  invoices,
  profileMap,
  receiptByInvoice,
}: {
  invoices: InvoiceRow[]
  profileMap: Record<string, ProfileRow>
  receiptByInvoice: Record<string, string>
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (filter !== 'all' && inv.status !== filter) return false
      if (search) {
        const name = profileMap[inv.user_id]?.full_name?.toLowerCase() ?? ''
        const desc = inv.description.toLowerCase()
        if (!name.includes(search.toLowerCase()) && !desc.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [invoices, filter, search, profileMap])

  const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length
  const paidCount = invoices.filter((i) => i.status === 'paid').length
  const totalOutstanding = invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + i.amount_cents, 0)
  const totalCollected = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_cents, 0)

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: invoices.length },
    { id: 'unpaid', label: 'Unpaid', count: unpaidCount },
    { id: 'paid', label: 'Paid', count: paidCount },
    { id: 'void', label: 'Void', count: invoices.filter((i) => i.status === 'void').length },
  ]

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-red-400 mb-1">Outstanding</div>
          <div className="text-2xl font-bold text-red-300">{formatAmount(totalOutstanding)}</div>
          <div className="text-xs text-red-500 mt-1">{unpaidCount} unpaid invoice{unpaidCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl border border-green-900/50 bg-green-950/30 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-green-400 mb-1">Collected</div>
          <div className="text-2xl font-bold text-green-300">{formatAmount(totalCollected)}</div>
          <div className="text-xs text-green-500 mt-1">{paidCount} paid invoice{paidCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Total</div>
          <div className="text-2xl font-bold text-gray-100">{invoices.length}</div>
          <div className="text-xs text-gray-600 mt-1">all invoices</div>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
              <span className={`rounded px-1.5 py-0.5 ${filter === f.id ? 'bg-gray-600 text-gray-200' : 'bg-gray-800 text-gray-500'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or description…"
          className="w-60 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:border-gray-600 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Description</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Amount</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Due</th>
              <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((inv) => {
              const profile = profileMap[inv.user_id]
              const receiptId = receiptByInvoice[inv.id] ?? null
              const isOverdue = inv.status === 'unpaid' && inv.due_date < today
              return (
                <tr key={inv.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-100">
                    {profile?.full_name ?? <span className="text-gray-600 italic">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{inv.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-100">
                    {formatAmount(inv.amount_cents)}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${isOverdue ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                    {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {isOverdue && <span className="ml-1 text-red-500">overdue</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      inv.status === 'paid'
                        ? 'bg-green-950 border border-green-800 text-green-300'
                        : inv.status === 'void'
                        ? 'bg-gray-800 border border-gray-700 text-gray-500'
                        : 'bg-red-950 border border-red-800 text-red-300'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end items-center gap-2 flex-wrap">
                      {inv.status === 'unpaid' && <MarkPaidButton invoiceId={inv.id} />}
                      <a
                        href={`/invoice/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600"
                      >
                        Invoice PDF
                      </a>
                      {receiptId && (
                        <a
                          href={`/receipt/${receiptId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600"
                        >
                          Receipt PDF
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
                      {inv.status !== 'paid' && (
                        <EditInvoiceModal invoice={inv} />
                      )}
                      {inv.status !== 'paid' && (
                        <DeleteInvoiceButton invoiceId={inv.id} />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                  {search || filter !== 'all' ? 'No invoices match your filter.' : 'No invoices yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">{filtered.length} of {invoices.length} invoices</p>
    </div>
  )
}
