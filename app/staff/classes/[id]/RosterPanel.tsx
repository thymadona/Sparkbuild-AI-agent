'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserMinusIcon, UserPlusIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  const [open, setOpen] = useState(false)

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
      return false
    }
    setPick('')
    router.refresh()
    return true
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Students ({students.length})</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}>
            <UserPlusIcon />
            Add student
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a student</DialogTitle>
              <DialogDescription>
                Students of your school who aren&apos;t in this class.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (pick && (await send(pick, 'POST'))) setOpen(false)
              }}
              className="space-y-4"
            >
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Student to add"
              >
                <option value="">
                  {candidates.length ? 'Choose a student…' : 'No other students to add'}
                </option>
                {candidates.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name ? `${p.name} (${p.email})` : p.email}
                  </option>
                ))}
              </select>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={!pick || busy !== null}>
                  {busy ? 'Adding…' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && !open && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <DataTable
        rows={students}
        getRowId={(p) => p.userId}
        noun="students"
        emptyText="No students in this class yet."
        search={{ placeholder: 'Search students', text: (p) => `${p.name} ${p.email}` }}
        columns={[
          {
            id: 'name',
            header: 'Name',
            sortValue: (p) => p.name.toLowerCase(),
            cell: (p) => (
              <span className="font-medium text-foreground">
                {p.name || <span className="italic text-muted-foreground/70">No name</span>}
              </span>
            ),
          },
          {
            id: 'email',
            header: 'Email',
            cell: (p) => <span className="text-muted-foreground">{p.email}</span>,
          },
          {
            id: 'remove',
            header: '',
            className: 'text-right',
            cell: (p) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => send(p.userId, 'DELETE')}
                disabled={busy !== null}
                className="text-destructive"
              >
                <UserMinusIcon />
                {busy === p.userId ? 'Removing…' : 'Remove'}
              </Button>
            ),
          },
        ]}
      />
    </section>
  )
}
