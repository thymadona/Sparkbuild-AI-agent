'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface RosterPerson {
  userId: string
  name: string
  email: string
}

interface Props {
  classId: string
  students: RosterPerson[]
  // Students of the org who are not in this class yet.
  candidates: RosterPerson[]
}

// A teacher's view of the class roster: add or remove student members. The
// members route decides who may be moved; this only offers the candidates.
export default function RosterPanel({ classId, students, candidates }: Props) {
  const router = useRouter()
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function send(userId: string, method: 'POST' | 'DELETE') {
    setBusy(userId)
    setError('')
    const res =
      method === 'POST'
        ? await fetch(`/api/admin/classes/${classId}/members`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role: 'student' }),
          })
        : await fetch(`/api/admin/classes/${classId}/members?userId=${userId}`, { method })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(null)
    if (!res.ok) {
      setError(data.error ?? 'Could not update the class')
      return
    }
    setPick('')
    router.refresh()
  }

  const label = (p: RosterPerson) => (p.name ? `${p.name} (${p.email})` : p.email)

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Students ({students.length})</h2>

      {error && (
        <p className="mb-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (pick) send(pick, 'POST')
        }}
        className="mb-4 flex flex-col gap-2 sm:flex-row"
      >
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
          aria-label="Student to add"
        >
          <option value="">
            {candidates.length ? 'Choose a student to add…' : 'No other students to add'}
          </option>
          {candidates.map((p) => (
            <option key={p.userId} value={p.userId}>
              {label(p)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!pick || busy !== null}
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students in this class yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {students.map((p) => (
            <li key={p.userId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate text-foreground">{label(p)}</span>
              <button
                onClick={() => send(p.userId, 'DELETE')}
                disabled={busy !== null}
                className="shrink-0 text-xs text-destructive hover:text-destructive/80 disabled:opacity-50"
              >
                {busy === p.userId ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
