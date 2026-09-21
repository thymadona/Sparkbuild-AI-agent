'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type UserRow = { id: string; email: string; fullName: string; roles: string[] }

// Only these two are toggleable. 'student' is granted automatically by
// lib/auth/student-defaults.ts on every non-staff sign-in and the API rejects
// it (ASSIGNABLE_ROLES in app/api/admin/users/[id]/roles/route.ts), so it
// renders below as a read-only badge rather than a button.
const ROLES = ['admin', 'teacher'] as const

export default function UsersClient({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q)
    )
  }, [users, search])

  async function toggleRole(userId: string, role: string, hasRole: boolean) {
    if (busyId) return
    setBusyId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles${hasRole ? `?role=${role}` : ''}`, {
        method: hasRole ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: hasRole ? undefined : JSON.stringify({ role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not update role')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update role')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users…"
        className="w-64 rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{u.fullName || u.email}</div>
                  {u.fullName && <div className="text-xs text-muted-foreground">{u.email}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    {ROLES.map((role) => {
                      const hasRole = u.roles.includes(role)
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(u.id, role, hasRole)}
                          disabled={busyId === u.id}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                            hasRole
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                        >
                          {hasRole ? `✓ ${role}` : role}
                        </button>
                      )
                    })}
                    {u.roles.includes('student') && (
                      <Badge variant="outline" title="Assigned automatically on sign-in">
                        student
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-10 text-center text-sm text-muted-foreground/70"
                >
                  No users match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
