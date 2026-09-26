'use client'

import { SendIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <Button variant="outline" onClick={send} disabled={loading || sent}>
      <SendIcon />
      {sent ? 'Sent' : loading ? 'Sending…' : 'Send on Telegram'}
    </Button>
  )
}
