'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MarkPaidButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function markPaid() {
    setLoading(true)
    const res = await fetch(`/api/admin/invoices/${invoiceId}/pay`, { method: 'POST' })
    const data = await res.json() as { receipt_id?: string; error?: string }
    if (res.ok && data.receipt_id) {
      router.refresh()
      window.open(`/receipt/${data.receipt_id}`, '_blank')
    } else {
      alert(data.error ?? 'Failed to mark as paid')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={markPaid}
      disabled={loading}
      className="rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
    >
      {loading ? '…' : 'Mark Paid'}
    </button>
  )
}
