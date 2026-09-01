import { cache } from 'react'
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
 *
 * Wrapped in React's `cache()`, which dedupes it per render pass — not across
 * requests. A layout and the page inside it (app/staff/layout.tsx and
 * app/staff/page.tsx both call this) therefore share one sessions query
 * instead of issuing two. The validation guarantee is unchanged: the table is
 * still read once per request, and the cookie is still never trusted on its
 * own. proxy.ts is a separate function invocation and cannot share this.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
  }
})
