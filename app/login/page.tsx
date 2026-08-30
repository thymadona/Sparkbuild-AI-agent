import { redirect } from 'next/navigation'
import LoginForm from '@/app/LoginForm'
import Navbar from '@/components/Navbar'
import { getSessionUser } from '@/lib/auth/session'

export default async function LoginPage(props: { searchParams: Promise<{ reason?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await getSessionUser()
  const isDeactivated = searchParams.reason === 'deactivated'

  // A deactivated account keeps a valid session (deactivation only flips
  // student_profiles.is_active, it doesn't delete the sessions row), so
  // `user` stays truthy here. Redirecting to /dashboard in that case would
  // bounce straight back to this page via proxy.ts's deactivation check.
  if (user && !isDeactivated) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" />
      <div className="flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="w-full max-w-md">
          {isDeactivated && (
            <div className="mb-6 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
              Your account has been deactivated. Please contact your school administrator.
            </div>
          )}
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-bold text-fg-primary">Welcome back</h1>
            <p className="mt-2 text-fg-secondary">Sign in or create an account with Google.</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
