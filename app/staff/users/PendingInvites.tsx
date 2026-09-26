'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { PendingInvite } from '@/lib/org-invites'
import RoleBadge from '@/components/dashboard/RoleBadge'

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
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Pending invites ({invites.length})</h2>
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <DataTable
        rows={invites}
        getRowId={(i) => i.id}
        noun="invites"
        emptyText="No pending invites."
        columns={[
          {
            id: 'email',
            header: 'Email',
            sortValue: (i) => i.email,
            cell: (i) => <span className="font-medium text-foreground">{i.email}</span>,
          },
          { id: 'role', header: 'Role', cell: (i) => <RoleBadge role={i.role} /> },
          {
            id: 'sent',
            header: 'Invited',
            sortValue: (i) => i.createdAt,
            cell: (i) => (
              <span className="text-xs text-muted-foreground">{formatDate(i.createdAt)}</span>
            ),
          },
          {
            id: 'revoke',
            header: '',
            className: 'text-right',
            cell: (i) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revoke(i.id)}
                disabled={busyId !== null}
                className="text-destructive"
              >
                <XIcon />
                {busyId === i.id ? 'Revoking…' : 'Revoke'}
              </Button>
            ),
          },
        ]}
      />
    </section>
  )
}
