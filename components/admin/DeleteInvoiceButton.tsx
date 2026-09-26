'use client'

import { Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// redirectTo: where to go once the invoice is gone (its own page would 404).
export default function DeleteInvoiceButton({
  invoiceId,
  redirectTo,
}: {
  invoiceId: string
  redirectTo?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/admin/invoices/${invoiceId}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } else {
      const data = await res.json()
      alert(data.error ?? 'Failed to delete')
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Confirm delete'}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    )
  }

  return (
    <Button variant="outline" onClick={() => setConfirming(true)} className="text-destructive">
      <Trash2Icon />
      Delete
    </Button>
  )
}
