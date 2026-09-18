'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/admin/invoices/${invoiceId}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      alert(data.error ?? 'Failed to delete')
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {deleting ? '…' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      Delete
    </button>
  )
}
