'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type UserRow = { id: string; email: string; fullName: string; roles: string[] }

const ROLES = ['admin', 'teacher'] as const

export default function UsersClient({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter((u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
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
        className="w-64 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:border-gray-600 focus:outline-none"
      />

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Roles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-100">{u.fullName || u.email}</div>
                  {u.fullName && <div className="text-xs text-gray-500">{u.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {ROLES.map((role) => {
                      const hasRole = u.roles.includes(role)
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(u.id, role, hasRole)}
                          disabled={busyId === u.id}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                            hasRole
                              ? 'bg-violet-700 text-white hover:bg-violet-600'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {hasRole ? `✓ ${role}` : role}
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-sm text-gray-600">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
