'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Class } from '@/types'

export default function AddToClassModal({
  userId,
  studentName,
  classes,
}: {
  userId: string
  studentName: string
  classes: Class[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [classId, setClassId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!classId) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/classes/${classId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json() as { error?: string }
    if (!res.ok) {
      setError(data.error ?? 'Failed to add to class')
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
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-400 hover:text-indigo-300"
      >
        + Class
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-gray-900 border border-gray-800 p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-100">
              Add {studentName} to class
            </h2>
            {error && (
              <p className="mb-3 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <form onSubmit={submit} className="space-y-3">
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !classId}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Adding…' : 'Add to Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
