'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PendingInvite } from '@/lib/org-invites'

// Invites to SparkBuild Direct accounts that have not been answered yet. The
// account moves only when its owner accepts; revoking withdraws the offer.
export default function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (invites.length === 0) return null

  async function revoke(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not revoke the invite')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke the invite')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-md border border-border p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Pending invites</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y divide-border text-sm">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 break-all font-medium text-foreground">{invite.email}</span>
            <span className="text-xs text-muted-foreground">
              {invite.role} · {new Date(invite.createdAt).toLocaleDateString()}
            </span>
            <button
              onClick={() => revoke(invite.id)}
              disabled={busyId !== null}
              className="ml-auto rounded px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {busyId === invite.id ? 'Revoking…' : 'Revoke'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
