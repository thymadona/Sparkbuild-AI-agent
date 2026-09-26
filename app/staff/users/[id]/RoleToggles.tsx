'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpenIcon, CheckIcon, ShieldIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Only these two are toggleable. 'student' is granted automatically by
// lib/auth/student-defaults.ts on every non-staff sign-in and the API rejects
// it (ASSIGNABLE_ROLES in app/api/admin/users/[id]/roles/route.ts).
const ROLES = [
  {
    role: 'admin',
    label: 'Admin',
    hint: 'Runs the whole school: people, classes, billing.',
    icon: ShieldIcon,
  },
  {
    role: 'teacher',
    label: 'Teacher',
    hint: 'Sees and manages the classes they teach.',
    icon: BookOpenIcon,
  },
] as const

export default function RoleToggles({ userId, roles }: { userId: string; roles: string[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(role: string, hasRole: boolean) {
    if (busy) return
    setBusy(role)
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
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map(({ role, label, hint, icon: Icon }) => {
          const hasRole = roles.includes(role)
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggle(role, hasRole)}
              disabled={busy !== null}
              aria-pressed={hasRole}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-60',
                hasRole ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                  hasRole ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {label}
                  {hasRole && <CheckIcon className="h-4 w-4 text-primary" />}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {busy === role ? 'Saving…' : hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
