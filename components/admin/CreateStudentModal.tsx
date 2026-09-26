'use client'

import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateStudentModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    parent_email: '',
    parent_telegram_chat_id: '',
    notes: '',
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        parent_email: form.parent_email.trim() || undefined,
        parent_telegram_chat_id: form.parent_telegram_chat_id.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string }
    if (!res.ok) {
      setError(data.error ?? 'Failed to create student')
      setLoading(false)
      return
    }
    // A SparkBuild Direct account isn't moved until its owner accepts.
    if (data.status === 'invited')
      setNotice(`Invite sent to ${form.email.trim()}. They join when they accept it.`)
    setOpen(false)
    setForm({ full_name: '', email: '', parent_email: '', parent_telegram_chat_id: '', notes: '' })
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        New student
      </Button>
      {notice && !open && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-md bg-card border border-border p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Create Student</h2>
            {error && (
              <p className="mb-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Full name *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Student email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Parent email</label>
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) => set('parent_email', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="parent@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Parent Telegram chat_id
                </label>
                <input
                  value={form.parent_telegram_chat_id}
                  onChange={(e) => set('parent_telegram_chat_id', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="123456789"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Parent must send /start to your bot first. Check Telegram Updates below to find
                  their chat_id.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  placeholder="Optional internal notes"
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
                  {loading ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
