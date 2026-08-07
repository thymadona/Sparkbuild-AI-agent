import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getUserRoles } from '@/lib/auth/permissions'
import type { User } from '@supabase/supabase-js'

// Every non-admin, non-teacher sign-in is a student by default. Runs on
// every login, not just the first — `ignoreDuplicates` makes repeat logins
// a no-op so this never clobbers an admin's edits to an existing profile.
// Never throws: a failure here must not block sign-in.
async function ensureStudentProfile(user: User) {
  try {
    const roles = await getUserRoles(user.id)
    if (roles.includes('admin') || roles.includes('teacher')) return

    const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
    const { error } = await supabaseAdmin
      .from('student_profiles')
      .upsert({ user_id: user.id, full_name: fullName }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (error) console.error('student_profiles auto-create failed:', error.message)
  } catch (err) {
    console.error('ensureStudentProfile failed:', err)
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (data.user) await ensureStudentProfile(data.user)
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // Something went wrong — redirect to login with error indicator
  return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin))
}
