'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Invoice = {
  id: string
  amount_cents: number
  description: string
  due_date: string
}

export default function EditInvoiceModal({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false)
  const [amountDollars, setAmountDollars] = useState((invoice.amount_cents / 100).toFixed(2))
  const [description, setDescription] = useState(invoice.description)
  const [dueDate, setDueDate] = useState(invoice.due_date)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_cents: Math.round(parseFloat(amountDollars) * 100),
        description,
        due_date: dueDate,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to update')
      return
    }
    setOpen(false)
    router.refresh()
  }

  function handleOpen() {
    setAmountDollars((invoice.amount_cents / 100).toFixed(2))
    setDescription(invoice.description)
    setDueDate(invoice.due_date)
    setError(null)
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-96 rounded-md border border-border bg-card p-6 shadow-xl">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Edit Invoice</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Amount (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
