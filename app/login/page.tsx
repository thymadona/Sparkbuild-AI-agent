import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LoginForm from '@/app/LoginForm'
import Navbar from '@/components/Navbar'

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" />
      <div className="flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-bold text-fg-primary">Welcome back</h1>
            <p className="mt-2 text-fg-secondary">Sign in to your account. No password needed.</p>
          </div>
          <LoginForm />
          <p className="mt-6 text-center text-sm text-fg-muted">
            New here?{' '}
            <a href="/register" className="text-brand-400 hover:text-brand-300 transition-colors">
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
