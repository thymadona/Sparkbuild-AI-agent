import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decideGuard } from '@/lib/auth/guard'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components to access auth state
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/editor') ||
    pathname.startsWith('/profile')
  const isAdminPath = pathname.startsWith('/admin')
  const isTeacherPath = pathname.startsWith('/teacher')

  // Deactivation check — block access for deactivated student accounts
  let isDeactivated = false
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('is_active')
      .eq('user_id', user.id)
      .maybeSingle()

    // profile == null means no student_profiles row (e.g. admin users) — allow through
    isDeactivated = profile !== null && profile?.is_active === false
  }

  // Only pay the RPC round-trip on /admin and /teacher navigations — every
  // other path incurs zero extra latency, mirroring the old
  // pathname.startsWith('/admin') gating.
  let isAdminUser = false
  let hasTeacherAccess = false
  if (user && (isAdminPath || isTeacherPath)) {
    const [adminResult, teacherResult] = await Promise.all([
      supabase.rpc('is_admin', { p_user_id: user.id }),
      supabase.rpc('can_access_teacher_dashboard', { p_user_id: user.id }),
    ])
    if (adminResult.error) console.error('middleware: is_admin RPC failed:', adminResult.error)
    if (teacherResult.error) console.error('middleware: can_access_teacher_dashboard RPC failed:', teacherResult.error)
    // Fail closed: a transient DB error locks admins/teachers out of
    // /admin and /teacher rather than letting them through — accepted
    // tradeoff for a PII/admin surface.
    isAdminUser = adminResult.error ? false : adminResult.data === true
    hasTeacherAccess = teacherResult.error ? false : teacherResult.data === true
  }

  const decision = decideGuard({
    pathname,
    user: user ? { id: user.id, email: user.email } : null,
    isDeactivated,
    isAdmin: isAdminUser,
    hasTeacherAccess,
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

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - /auth/callback (magic link callback must be accessible without session)
     * - /share (public share pages)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|share).*)',
  ],
}
