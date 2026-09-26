'use client'

import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    const data = (await res.json()) as { error?: string }
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon />
        Add to class
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-md bg-card border border-border p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              Add {studentName} to class
            </h2>
            {error && (
              <p className="mb-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <form onSubmit={submit} className="space-y-3">
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !classId}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
