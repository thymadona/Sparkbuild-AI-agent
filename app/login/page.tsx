import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LoginForm from '@/app/LoginForm'
import Navbar from '@/components/Navbar'

export default async function LoginPage({ searchParams }: { searchParams: { reason?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const isDeactivated = searchParams.reason === 'deactivated'

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
