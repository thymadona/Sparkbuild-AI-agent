'use client'

import { useState } from 'react'
import AppShell from '@/components/AppShell'
import type { AccountLinks } from '@/lib/account-links'
import type { MyInvite } from '@/lib/org-invites'
import InviteBanner from '@/components/InviteBanner'

interface Props {
  email: string
  initialName: string
  xp: number
  links?: AccountLinks
  invites?: MyInvite[]
}

export default function ProfileClient({ email, initialName, xp, links, invites = [] }: Props) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name }),
    })

    setSaving(false)
    if (res.ok) {
      setSaved(true)
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not save your name')
    }
  }

  return (
    <AppShell userEmail={email} xp={xp} links={links}>
      <section>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-fg-primary">
          Your profile
        </h1>
        <p className="mt-2 text-lg text-fg-secondary">This is the name your teacher sees.</p>
      </section>

      <InviteBanner invites={invites} />

      <form
        onSubmit={handleSave}
        className="flex max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-semibold text-fg-secondary">Email</label>
          <div className="rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-fg-secondary">
            {email}
          </div>
        </div>

        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-semibold text-fg-secondary">
            Full Name
          </label>
          <input
            id="full_name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            placeholder="Your full name"
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-fg-primary placeholder:text-fg-muted focus:border-ring focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}

        <button type="submit" disabled={saving} className="btn-primary self-start">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </AppShell>
  )
}
