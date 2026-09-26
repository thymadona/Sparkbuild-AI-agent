'use client'

import { useState } from 'react'
import type { MyInvite } from '@/lib/org-invites'

// A school's invite to a signed-in SparkBuild Direct user, with Accept and
// Decline. Accepting moves the account into that school (lib/org-move.ts),
// then reloads the whole page so the lessons, nav and access policy all come
// from the new org.
export default function InviteBanner({ invites }: { invites: MyInvite[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; text: string } | null>(null)

  async function answer(id: string, action: 'accept' | 'decline') {
    setBusy(id)
    setError(null)
    const res = await fetch(`/api/invites/${id}/${action}`, { method: 'POST' })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setBusy(null)
      setError({ id, text: data.error ?? 'Something went wrong. Try again.' })
      return
    }
    if (action === 'accept') {
      window.location.assign('/lessons')
      return
    }
    setBusy(null)
    setHidden((h) => new Set(h).add(id))
  }

  const shown = invites.filter((i) => !hidden.has(i.id))
  if (shown.length === 0) return null

  return (
    <div className="space-y-3">
      {shown.map((invite) => (
        <div
          key={invite.id}
          className="rounded-2xl border border-primary/40 bg-card px-5 py-4 text-fg-primary"
        >
          <p className="font-semibold">
            {invite.orgName} invited you to join as a {invite.role}.
          </p>
          {confirming === invite.id ? (
            <p className="mt-1 text-sm text-fg-secondary">
              Your projects, XP and streak come with you. After you join, your school opens new
              lessons through your class.
            </p>
          ) : null}
          {error?.id === invite.id && <p className="mt-2 text-sm text-red-600">{error.text}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {confirming === invite.id ? (
              <button
                onClick={() => answer(invite.id, 'accept')}
                disabled={busy !== null}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === invite.id ? 'Joining…' : `Join ${invite.orgName}`}
              </button>
            ) : (
              <button
                onClick={() => setConfirming(invite.id)}
                disabled={busy !== null}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Accept
              </button>
            )}
            <button
              onClick={() => answer(invite.id, 'decline')}
              disabled={busy !== null}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-fg-secondary disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
