'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateStudentModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    const data = await res.json() as { error?: string }
    if (!res.ok) {
      setError(data.error ?? 'Failed to create student')
      setLoading(false)
      return
    }
    setOpen(false)
    setForm({ full_name: '', email: '', parent_email: '', parent_telegram_chat_id: '', notes: '' })
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        + New Student
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-100">Create Student</h2>
            {error && (
              <p className="mb-3 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Full name *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Student email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Parent email</label>
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) => set('parent_email', e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  placeholder="parent@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Parent Telegram chat_id</label>
                <input
                  value={form.parent_telegram_chat_id}
                  onChange={(e) => set('parent_telegram_chat_id', e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  placeholder="123456789"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Parent must send /start to your bot first. Check Telegram Updates below to find their chat_id.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Optional internal notes"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
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
