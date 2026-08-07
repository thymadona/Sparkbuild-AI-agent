// Pure decision logic for middleware.ts's route guards. No next/server,
// next/headers, or Supabase imports — middleware can't reach
// lib/auth/permissions.ts (that module imports lib/supabase-server.ts,
// which calls cookies() from next/headers and isn't valid in the Edge
// middleware request lifecycle), and this separation is also what makes
// the guard testable without mocking NextRequest.

export interface GuardUser {
  id: string
  email?: string | null
}

export interface GuardInput {
  pathname: string
  user: GuardUser | null
  isDeactivated: boolean
  isAdmin: boolean
  // Must already be admin-inclusive (computed via the can_access_teacher_dashboard
  // SQL function) — this function does not independently OR it with isAdmin.
  hasTeacherAccess: boolean
}

export interface GuardResult {
  redirect: string
  params?: Record<string, string>
}

export function decideGuard(input: GuardInput): GuardResult | null {
  const { pathname, user } = input
  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/editor') || pathname.startsWith('/profile')
  const isAdminPath = pathname.startsWith('/admin')
  const isTeacherPath = pathname.startsWith('/teacher')

  if (!user && (isProtected || isAdminPath || isTeacherPath)) {
    return { redirect: '/login' }
  }
  if (!user) return null

  // Deactivation check — only gates /dashboard, /editor, /profile, matching
  // the pre-existing middleware precedence (staff accounts typically have
  // no student_profiles row, so this never fires for them regardless of path).
  if (isProtected && input.isDeactivated) {
    return { redirect: '/login', params: { reason: 'deactivated' } }
  }

  if (isAdminPath && !input.isAdmin) {
    return { redirect: '/dashboard' }
  }

  if (isTeacherPath && !input.hasTeacherAccess) {
    return { redirect: '/dashboard' }
  }

  return null
}
