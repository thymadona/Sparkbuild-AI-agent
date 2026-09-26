'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { personNotice, send } from './console-actions'

// The console's create button: a school and its first admin, in one POST.
export default function NewSchoolDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ orgId: string; notice: string } | null>(null)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setError(null)
      setCreated(null)
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const adminEmail = String(f.get('adminEmail') ?? '')
    setBusy(true)
    setError(null)
    try {
      const data = await send('/api/platform/orgs', 'POST', {
        name: f.get('name'),
        slug: f.get('slug'),
        adminEmail,
        adminName: f.get('adminName'),
      })
      setCreated({
        orgId: data.orgId,
        notice: `Created ${f.get('name')}. ${personNotice(adminEmail, data.admin)}`,
      })
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
        <PlusIcon />
        New school
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New school</DialogTitle>
          <DialogDescription>Create the org and name its first admin by email.</DialogDescription>
        </DialogHeader>

        {created ? (
          <>
            <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {created.notice}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              <Link href={`/console/orgs/${created.orgId}`} className={buttonVariants()}>
                Open school
              </Link>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="School name">
                <Input name="name" required placeholder="Riverside School" />
              </Field>
              <Field label="Slug" hint="Lowercase letters, digits and dashes">
                <Input
                  name="slug"
                  required
                  placeholder="riverside"
                  pattern="[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?"
                  title="Lowercase letters, digits and dashes"
                />
              </Field>
              <Field label="First admin's email">
                <Input name="adminEmail" type="email" required placeholder="admin@school.edu" />
              </Field>
              <Field label="First admin's name">
                <Input name="adminName" placeholder="Optional" />
              </Field>
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create school'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
