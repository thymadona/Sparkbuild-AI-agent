'use client'

import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// With userId, invoices that student (their page). With students instead, the
// dialog asks which one (the Billing page's create button).
export default function CreateInvoiceModal({
  userId,
  studentName,
  students,
}: {
  userId?: string
  studentName?: string
  students?: { userId: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ amount: '', description: '', due_date: '' })
  const [pickedId, setPickedId] = useState('')
  const targetId = userId ?? pickedId

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(form.amount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!targetId) {
      setError('Choose a student')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: targetId,
        amount_cents: amountCents,
        description: form.description.trim(),
        due_date: form.due_date,
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setError(data.error ?? 'Failed to create invoice')
      setLoading(false)
      return
    }
    setOpen(false)
    setForm({ amount: '', description: '', due_date: '' })
    setPickedId('')
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        New invoice
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-md bg-card border border-border p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {studentName ? `Invoice for ${studentName}` : 'New invoice'}
            </h2>
            {error && (
              <p className="mb-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <form onSubmit={submit} className="space-y-3">
              {!userId && students && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Student *</label>
                  <select
                    required
                    value={pickedId}
                    onChange={(e) => setPickedId(e.target.value)}
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Choose a student…</option>
                    {students.map((st) => (
                      <option key={st.userId} value={st.userId}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Amount (USD) *</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="150.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Description *</label>
                <input
                  required
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Term 1 tuition fee"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Due date *</label>
                <input
                  required
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set('due_date', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
