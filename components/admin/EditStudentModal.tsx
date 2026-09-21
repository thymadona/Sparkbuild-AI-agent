'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type StudentProfile = {
  userId: string
  fullName: string
  parentEmail: string
  parentTelegramChatId: string
  notes: string
}

export default function EditStudentModal({ student }: { student: StudentProfile }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: student.fullName,
    parent_email: student.parentEmail,
    parent_telegram_chat_id: student.parentTelegramChatId,
    notes: student.notes,
  })

  function handleOpen() {
    setForm({
      full_name: student.fullName,
      parent_email: student.parentEmail,
      parent_telegram_chat_id: student.parentTelegramChatId,
      notes: student.notes,
    })
    setError('')
    setOpen(true)
  }

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/admin/students/${student.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: form.full_name.trim(),
        parent_email: form.parent_email.trim() || null,
        parent_telegram_chat_id: form.parent_telegram_chat_id.trim() || null,
        notes: form.notes.trim() || null,
      }),
    })

    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setError(data.error ?? 'Failed to update')
      setLoading(false)
      return
    }

    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70 transition-colors"
        title="Edit student"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Edit Student</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Full name
                </label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Parent email
                </label>
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) => set('parent_email', e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Parent Telegram chat ID
                </label>
                <input
                  value={form.parent_telegram_chat_id}
                  onChange={(e) => set('parent_telegram_chat_id', e.target.value)}
                  placeholder="123456789"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                  placeholder="Internal notes about this student…"
                  className="w-full resize-none rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  {loading ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
