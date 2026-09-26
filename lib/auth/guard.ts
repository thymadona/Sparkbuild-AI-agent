// Pure decision logic for proxy.ts's route guards: which paths are protected,
// and what a given user is allowed to reach. No next/server, next/headers or
// database imports, so the rules can be tested directly as functions instead
// of by mocking a NextRequest and a connection.
//
// (The original reason for the split — that middleware ran on the Edge runtime
// and could not reach a module doing database work — no longer applies. Proxy
// runs on Node and queries Postgres itself. The testability is why it stays.)

export interface GuardUser {
  id: string
  email?: string | null
}

export interface GuardInput {
  pathname: string
  user: GuardUser | null
  isDeactivated: boolean
  isAdmin: boolean
  // Must already be admin-inclusive (computed by
  // queryCanAccessTeacherDashboard) — this function does not independently OR it with isAdmin.
  hasTeacherAccess: boolean
  // The platform owner (org-less platform_admin grant). Gates /console only.
  isPlatformAdmin: boolean
  // The user's org is suspended (and they are not the platform owner).
  isSuspended: boolean
}

export interface GuardResult {
  redirect: string
  params?: Record<string, string>
}

export function decideGuard(input: GuardInput): GuardResult | null {
  const { pathname, user } = input
  const isProtected =
    pathname.startsWith('/lessons') ||
    pathname.startsWith('/board') ||
    pathname.startsWith('/profile')
  const isAdminPath = pathname.startsWith('/admin')
  const isTeacherPath = pathname.startsWith('/teacher')
  // The unified admin+teacher dashboard. Gated identically to /teacher —
  // hasTeacherAccess is already admin-inclusive (see the field comment
  // above) — so this is one check, not isAdmin || hasTeacherAccess.
  const isStaffPath = pathname.startsWith('/staff')
  const isConsolePath = pathname.startsWith('/console')

  if (!user && (isProtected || isAdminPath || isTeacherPath || isStaffPath || isConsolePath)) {
    return { redirect: '/login' }
  }
  if (!user) return null

  // A paused org's members see one page, whatever they asked for. /login
  // stays reachable so they can switch account. API calls are refused in
  // proxy.ts rather than redirected.
  if (input.isSuspended) {
    if (pathname === '/paused' || pathname === '/login') return null
    return { redirect: '/paused' }
  }

  if (isConsolePath && !input.isPlatformAdmin) {
    return { redirect: '/lessons' }
  }

  // Deactivation check — only gates /lessons, /board, /profile, matching
  // the pre-existing middleware precedence (staff accounts typically have
  // no student_profiles row, so this never fires for them regardless of path).
  if (isProtected && input.isDeactivated) {
    return { redirect: '/login', params: { reason: 'deactivated' } }
  }

  if (isAdminPath && !input.isAdmin) {
    return { redirect: '/lessons' }
  }

  if (isTeacherPath && !input.hasTeacherAccess) {
    return { redirect: '/lessons' }
  }

  if (isStaffPath && !input.hasTeacherAccess) {
    return { redirect: '/lessons' }
  }

  return null
}
