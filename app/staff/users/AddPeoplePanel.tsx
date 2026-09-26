'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Role = 'student' | 'teacher'
type ImportResult = {
  added: { line: number; email: string; status: 'created' | 'granted' | 'invited' }[]
  failed: { line: number; email: string; reason: string }[]
}

const TEMPLATE =
  'email,name,role,parent_email\nsok.dara@school.test,Sok Dara,student,parent@example.test\n'

const OUTCOME: Record<string, string> = {
  created: 'Added. They join by signing in with Google on that email.',
  granted: 'They were already here; the role is added.',
  invited: 'They have a SparkBuild account, so an invite was sent. They join when they accept.',
}

const field =
  'w-full rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// Adds students and teachers to this org: one by email, or many from a CSV.
// Every outcome comes from the server (app/api/admin/people); this only shows it.
export default function AddPeoplePanel() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', name: '', role: 'student' as Role, parent: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [imported, setImported] = useState<ImportResult | null>(null)

  async function addOne(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          role: form.role,
          parentEmail: form.role === 'student' ? form.parent : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not add that person')
      setMessage({ ok: true, text: OUTCOME[data.status] ?? 'Done.' })
      setForm((f) => ({ ...f, email: '', name: '', parent: '' }))
      router.refresh()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not add' })
    } finally {
      setBusy(false)
    }
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage(null)
    setImported(null)
    try {
      const csv = await file.text()
      const res = await fetch('/api/admin/people/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not import that file')
      setImported(data as ImportResult)
      router.refresh()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not import' })
    } finally {
      setBusy(false)
    }
  }

  const invitedCount = imported?.added.filter((a) => a.status === 'invited').length ?? 0

  return (
    <section className="rounded-md border border-border p-4 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Add people</h2>

      <form onSubmit={addOne} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email"
          aria-label="Email"
          className={field}
        />
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Full name"
          aria-label="Full name"
          className={field}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          aria-label="Role"
          className={field}
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
        <input
          type="email"
          value={form.parent}
          onChange={(e) => setForm({ ...form, parent: e.target.value })}
          placeholder="Parent email (optional)"
          aria-label="Parent email"
          disabled={form.role !== 'student'}
          className={`${field} disabled:opacity-50`}
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Working…' : 'Add'}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="cursor-pointer rounded border border-input px-3 py-1.5 font-medium text-foreground hover:bg-muted">
          Import CSV…
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={importFile}
            disabled={busy}
            className="sr-only"
          />
        </label>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
          download="people-template.csv"
          className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Download template
        </a>
        <span className="text-xs text-muted-foreground">
          Columns: email, name, role (student or teacher), parent_email. Up to 500 rows.
        </span>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded border px-3 py-2 text-sm ${
            message.ok
              ? 'border-border bg-muted text-foreground'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </p>
      )}

      {imported && (
        <div role="status" className="space-y-2 text-sm">
          <p className="text-foreground">
            {imported.added.length} added
            {invitedCount > 0 && ` (${invitedCount} invited, they join when they accept)`},{' '}
            {imported.failed.length} not added.
          </p>
          {imported.failed.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 font-medium">Line</th>
                    <th className="px-2 py-1 font-medium">Email</th>
                    <th className="px-2 py-1 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {imported.failed.map((f) => (
                    <tr key={f.line} className="border-t border-border">
                      <td className="px-2 py-1 tabular-nums">{f.line}</td>
                      <td className="px-2 py-1 break-all">{f.email || '—'}</td>
                      <td className="px-2 py-1">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
