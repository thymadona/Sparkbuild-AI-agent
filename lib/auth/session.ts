import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { isSuspendedFor } from '@/lib/orgs'

export interface SessionUser {
  id: string
  email: string
  name: string
  /** The user's organization (users.org_id); SparkBuild Direct for B2C. */
  orgId: string
}

/**
 * The authenticated user, or null. This is the single replacement for the old
 * `createServerSupabaseClient().auth.getUser()` call that appeared in every
 * page, layout and route handler.
 *
 * Validated against the sessions table on every call rather than trusted from
 * the cookie, so a revoked session stops working immediately.
 *
 * Wrapped in React's `cache()`, so a layout and the page inside it share one
 * sessions query per render pass. The table is still read once per request.
 * proxy.ts is a separate invocation and cannot share this.
 *
 * A member of a suspended org gets null, so every route that starts here
 * refuses them (proxy.ts shows pages the /paused screen instead). This fails
 * closed: if the check itself errors, a school user is treated as paused.
 * Direct users never reach the query.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const orgId = session.user.orgId as string
  const suspended = await isSuspendedFor(session.user.id, orgId).catch((err) => {
    console.error('getSessionUser: suspension check failed:', err)
    return true
  })
  if (suspended) return null
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
    orgId,
  }
})
