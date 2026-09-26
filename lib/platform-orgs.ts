import { NextResponse } from 'next/server'
import { getSessionUser, type SessionUser } from '@/lib/auth/session'
import { isPlatformAdmin } from '@/lib/auth/permissions'
import type { AddPersonResult } from '@/lib/org-people'

// Slugs the platform keeps for itself: they are, or will be, its own hosts (D2).
export const RESERVED_SLUGS = ['app', 'console', 'www', 'api', 'admin', 'staff'] as const

// Mirrors organizations_slug_check: a DNS label.
export function validSlug(slug: string): boolean {
  return (
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) &&
    !(RESERVED_SLUGS as readonly string[]).includes(slug)
  )
}

// The first lines of every /api/platform route: signed in, then the platform
// owner. Returns the user, or the response to send.
export async function requirePlatformAdmin(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isPlatformAdmin(user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return user
}

// Thrown inside a transaction to roll it back when the person can't join.
export class PersonConflict extends Error {}

export function personResponse(result: Exclude<AddPersonResult, { kind: 'conflict' }>) {
  return result.kind === 'invited'
    ? { status: 'invited' as const, inviteId: result.inviteId }
    : { status: result.kind, userId: result.userId }
}

export const CONFLICT_MESSAGE = 'That email already belongs to another school'
