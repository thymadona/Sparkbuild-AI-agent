import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export interface SessionUser {
  id: string
  email: string
  name: string
}

/**
 * The authenticated user, or null. This is the single replacement for the old
 * `createServerSupabaseClient().auth.getUser()` call that appeared in every
 * page, layout and route handler.
 *
 * Validated against the sessions table on every call rather than trusted from
 * the cookie, so a revoked session stops working immediately.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
  }
}
