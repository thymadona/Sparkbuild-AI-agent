'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ConsoleOrg } from './orgs-data'

const INPUT =
  'w-full rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring'

type PersonResult = { status: 'created' | 'granted' | 'invited' }

// What happened to the named admin, in words.
function personNotice(email: string, result: PersonResult): string {
  if (result.status === 'invited')
    return `${email} already has a SparkBuild account, so they got an invite. They join once they accept it.`
  if (result.status === 'granted') return `${email} is now an admin.`
  return `${email} is the admin. They sign in with Google on that address.`
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
  return data
}

export default function ConsoleClient({
  orgs,
  directOrgId,
}: {
  orgs: ConsoleOrg[]
  directOrgId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(key: string, action: () => Promise<string | null>) {
    if (busy) return false
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      setNotice(await action())
      router.refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function createOrg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const adminEmail = String(f.get('adminEmail') ?? '')
    const ok = await run('create', async () => {
      const data = await send('/api/platform/orgs', 'POST', {
        name: f.get('name'),
        slug: f.get('slug'),
        adminEmail,
        adminName: f.get('adminName'),
      })
      return `Created ${f.get('name')}. ${personNotice(adminEmail, data.admin)}`
    })
    if (ok) form.reset()
  }

  async function addAdmin(orgId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const email = String(new FormData(form).get('email') ?? '')
    const ok = await run(`admin:${orgId}`, async () =>
      personNotice(email, await send(`/api/platform/orgs/${orgId}/admins`, 'POST', { email }))
    )
    if (ok) form.reset()
  }

  function setStatus(org: ConsoleOrg, status: ConsoleOrg['status']) {
    return run(`status:${org.id}`, async () => {
      await send(`/api/platform/orgs/${org.id}`, 'PATCH', { status })
      return status === 'suspended'
        ? `${org.name} is paused. Its members can't sign in until you restore it.`
        : `${org.name} is active again.`
    })
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={createOrg}
        className="space-y-3 rounded-md border border-border p-4"
        aria-label="New school"
      >
        <h2 className="text-sm font-semibold">New school</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="School name" className={INPUT} />
          <input
            name="slug"
            required
            placeholder="slug (e.g. riverside)"
            pattern="[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?"
            title="Lowercase letters, digits and dashes"
            className={INPUT}
          />
          <input
            name="adminEmail"
            type="email"
            required
            placeholder="First admin's email"
            className={INPUT}
          />
          <input name="adminName" placeholder="First admin's name" className={INPUT} />
        </div>
        <Button type="submit" disabled={busy !== null}>
          {busy === 'create' ? 'Creating…' : 'Create school'}
        </Button>
      </form>

      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded border border-border bg-muted px-3 py-2 text-sm">{notice}</div>
      )}

      <ul className="space-y-3">
        {orgs.map((org) => {
          const isDirect = org.id === directOrgId
          return (
            <li key={org.id} className="space-y-3 rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{org.name}</span>
                    <Badge variant={org.status === 'active' ? 'outline' : 'destructive'}>
                      {org.status === 'active' ? 'active' : 'paused'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {org.slug} · {org.members} {org.members === 1 ? 'member' : 'members'}
                  </div>
                </div>
                {!isDirect && (
                  <Button
                    variant={org.status === 'active' ? 'outline' : 'default'}
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => setStatus(org, org.status === 'active' ? 'suspended' : 'active')}
                  >
                    {org.status === 'active' ? 'Pause' : 'Restore'}
                  </Button>
                )}
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Admins: </span>
                {org.admins.length === 0 && org.pendingInvites.length === 0 && (
                  <span className="text-muted-foreground/70">none yet</span>
                )}
                <span className="inline-flex flex-wrap gap-1.5 align-middle">
                  {org.admins.map((a) => (
                    <Badge key={a.email} variant="secondary" title={a.name}>
                      {a.email}
                    </Badge>
                  ))}
                  {org.pendingInvites.map((i) => (
                    <Badge key={i.email} variant="outline" title={`Invited as ${i.role}`}>
                      {i.email} · invited, waiting to accept
                    </Badge>
                  ))}
                </span>
              </div>

              <form
                onSubmit={(e) => addAdmin(org.id, e)}
                className="flex flex-col gap-2 sm:flex-row"
                aria-label={`Add an admin to ${org.name}`}
              >
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Add an admin by email"
                  className={INPUT}
                />
                <Button type="submit" variant="outline" disabled={busy !== null}>
                  Add admin
                </Button>
              </form>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
