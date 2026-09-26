import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { studentProfiles } from '@/lib/db/schema'
import { decideGuard } from '@/lib/auth/guard'
import {
  queryCanAccessTeacherDashboard,
  queryIsAdmin,
  queryIsEnrolledInClass,
} from '@/lib/auth/permissions'

// Renamed from middleware.ts: `middleware` is deprecated in Next 16 and the
// convention is now `proxy`. Proxy defaults to the Node.js runtime, and the
// `runtime` config option is not available here — setting it throws. Node is
// what this guard needs: it makes several database round-trips, which the Edge
// runtime could not do over a TCP Postgres connection.

// Uncached on purpose: a role change takes effect on the next navigation.
// null on a database error, so each call site picks fail-open or fail-closed.
async function check(query: Promise<boolean>): Promise<boolean | null> {
  try {
    return await query
  } catch (err) {
    console.error('proxy: authorization check failed:', err)
    return null
  }
}

export async function proxy(request: NextRequest) {
  // Validated against the sessions table rather than trusted from the cookie.
  // Better Auth's cookie-only helper is explicitly documented as optimistic,
  // and this guard gates /admin, /teacher and /staff.
  const session = await auth.api.getSession({ headers: request.headers })
  const user = session?.user ?? null

  const { pathname } = request.nextUrl

  const isProtected =
    pathname.startsWith('/lessons') ||
    pathname.startsWith('/board') ||
    pathname.startsWith('/profile')
  const isAdminPath = pathname.startsWith('/admin')
  const isTeacherPath = pathname.startsWith('/teacher')
  const isStaffPath = pathname.startsWith('/staff')

  // Deactivation + class-assignment checks — only meaningful for accounts
  // that actually have a student_profiles row (admin/teacher accounts don't
  // get one, per the ensureStudentProfile hook in lib/auth/index.ts).
  let isDeactivated = false
  let needsClassAssignment = false
  if (isProtected && user) {
    const [profileRows, enrolled] = await Promise.all([
      // Scoped to the caller's own id. This used to run on the anon key under
      // an RLS policy; the connection now bypasses RLS, so the predicate is
      // the access control.
      db
        .select({ is_active: studentProfiles.isActive })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, user.id))
        .limit(1)
        .catch((err) => {
          console.error('proxy: student_profiles lookup failed:', err)
          return null
        }),
      check(queryIsEnrolledInClass(user.id)),
    ])

    // A missing row means "no student profile" (e.g. an admin) — allow through.
    const profile = profileRows === null ? null : (profileRows[0] ?? null)
    isDeactivated = profile !== null && profile.is_active === false

    // Fail open on error, matching the profile lookup above — this gates
    // product access, not an admin/PII surface, so a transient DB error
    // shouldn't lock a real student out of their own dashboard.
    const isEnrolled = enrolled === null ? true : enrolled
    needsClassAssignment = profile !== null && !isEnrolled
  }

  // Only pay the round-trip on /admin, /teacher and /staff navigations.
  let isAdminUser = false
  let hasTeacherAccess = false
  if (user && (isAdminPath || isTeacherPath || isStaffPath)) {
    const [adminResult, teacherResult] = await Promise.all([
      check(queryIsAdmin(user.id)),
      check(queryCanAccessTeacherDashboard(user.id)),
    ])
    // Fail closed: a transient DB error locks admins/teachers out rather than
    // letting them through — accepted tradeoff for a PII/admin surface.
    isAdminUser = adminResult === true
    hasTeacherAccess = teacherResult === true
  }

  const decision = decideGuard({
    pathname,
    user: user ? { id: user.id, email: user.email } : null,
    isDeactivated,
    isAdmin: isAdminUser,
    hasTeacherAccess,
    needsClassAssignment,
  })

  if (decision) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = decision.redirect
    if (decision.params) {
      for (const [key, value] of Object.entries(decision.params)) {
        redirectUrl.searchParams.set(key, value)
      }
    }
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - /api/auth (Better Auth's own endpoints — the OAuth callback must be
     *   reachable without a session, or sign-in can never complete)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
