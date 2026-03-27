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

    const data = await res.json() as { error?: string }
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
        className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600 transition-colors"
        title="Edit student"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-100">Edit Student</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Full name</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Parent email</label>
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) => set('parent_email', e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Parent Telegram chat ID</label>
                <input
                  value={form.parent_telegram_chat_id}
                  onChange={(e) => set('parent_telegram_chat_id', e.target.value)}
                  placeholder="123456789"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                  placeholder="Internal notes about this student…"
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
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
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
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
