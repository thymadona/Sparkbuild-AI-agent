'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PauseIcon, PlayIcon, UserPlusIcon } from 'lucide-react'
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
import { personNotice, send } from '../console-actions'

type Status = 'active' | 'suspended'

// Pause or restore an org. Direct can't be paused, so the page leaves this out.
export function StatusButton({
  orgId,
  name,
  status,
}: {
  orgId: string
  name: string
  status: Status
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next: Status = status === 'active' ? 'suspended' : 'active'

  async function toggle() {
    if (
      next === 'suspended' &&
      !window.confirm(`Pause ${name}? Its members can't sign in until you restore it.`)
    )
      return
    setBusy(true)
    setError(null)
    try {
      await send(`/api/platform/orgs/${orgId}`, 'PATCH', { status: next })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        variant={next === 'suspended' ? 'outline' : 'default'}
        disabled={busy}
        onClick={toggle}
      >
        {next === 'suspended' ? <PauseIcon /> : <PlayIcon />}
        {next === 'suspended' ? 'Pause' : 'Restore'}
      </Button>
    </>
  )
}

// Names another admin by email: a new email is pre-provisioned, an existing
// Direct account gets an invite it must accept.
export function AddAdminDialog({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setError(null)
      setNotice(null)
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const email = String(f.get('email') ?? '')
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const data = await send(`/api/platform/orgs/${orgId}/admins`, 'POST', {
        email,
        name: f.get('name'),
      })
      setNotice(personNotice(email, data))
      form.reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <UserPlusIcon />
        Add admin
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an admin</DialogTitle>
          <DialogDescription>
            They manage {name}&apos;s people, classes and billing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input name="email" type="email" required placeholder="admin@school.edu" />
          </Field>
          <Field label="Name">
            <Input name="name" placeholder="Optional" />
          </Field>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {notice}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding…' : 'Add admin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
