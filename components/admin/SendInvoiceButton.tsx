'use client'

import { useState } from 'react'

export default function SendInvoiceButton({
  invoiceId,
  receiptId,
  hasTelegramId,
}: {
  invoiceId: string
  receiptId?: string | null
  hasTelegramId: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  if (!hasTelegramId) {
    return (
      <span className="text-xs text-muted-foreground/70" title="No parent Telegram chat_id set">
        No Telegram
      </span>
    )
  }

  async function send() {
    setLoading(true)
    const receiptUrl = receiptId ? `${window.location.origin}/receipt/${receiptId}` : null
    const res = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptUrl }),
    })
    const data = (await res.json()) as { error?: string }
    if (res.ok) {
      setSent(true)
    } else {
      alert(data.error ?? 'Failed to send')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={send}
      disabled={loading || sent}
      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {sent ? 'Sent' : loading ? '…' : 'Send TG'}
    </button>
  )
}
