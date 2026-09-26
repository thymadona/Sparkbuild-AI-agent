'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DownloadIcon, UploadIcon, UserPlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'

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

// The page header's create button: one student or teacher by email. Every
// outcome comes from the server (app/api/admin/people); this only shows it.
export function AddPersonDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', role: 'student' as Role, parent: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setMessage(null)
  }

  async function submit(e: React.FormEvent) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <UserPlusIcon />
        Add person
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>
            A student or teacher, by the email they sign in with.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Full name">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </Field>
            <Field label="Parent email">
              <Input
                type="email"
                value={form.parent}
                onChange={(e) => setForm({ ...form, parent: e.target.value })}
                placeholder="Optional"
                disabled={form.role !== 'student'}
              />
            </Field>
          </div>
          {message && (
            <p
              role="status"
              className={`rounded-md px-3 py-2 text-sm ${
                message.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
              }`}
            >
              {message.text}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Many people at once from a CSV (app/api/admin/people/import), with the
// rows that failed and why.
export function ImportPeopleDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<ImportResult | null>(null)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setError(null)
      setImported(null)
    }
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
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
      setError(err instanceof Error ? err.message : 'Could not import')
    } finally {
      setBusy(false)
    }
  }

  const invitedCount = imported?.added.filter((a) => a.status === 'invited').length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UploadIcon />
        Import CSV
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import people from CSV</DialogTitle>
          <DialogDescription>
            Columns: email, name, role (student or teacher), parent_email. Up to 500 rows.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 ${busy ? 'pointer-events-none opacity-50' : ''}`}
          >
            <UploadIcon className="h-4 w-4" />
            {busy ? 'Importing…' : 'Choose file'}
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
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <DownloadIcon className="h-4 w-4" />
            Template
          </a>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {imported && (
          <div role="status" className="mt-4 space-y-2 text-sm">
            <p className="text-foreground">
              {imported.added.length} added
              {invitedCount > 0 && ` (${invitedCount} invited, they join when they accept)`},{' '}
              {imported.failed.length} not added.
            </p>
            {imported.failed.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Line</th>
                      <th className="px-2 py-1.5 font-medium">Email</th>
                      <th className="px-2 py-1.5 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imported.failed.map((f) => (
                      <tr key={f.line} className="border-t border-border">
                        <td className="px-2 py-1.5 tabular-nums">{f.line}</td>
                        <td className="break-all px-2 py-1.5">{f.email || '—'}</td>
                        <td className="px-2 py-1.5">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
