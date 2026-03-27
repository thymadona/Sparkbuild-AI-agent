import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LoginForm from '@/app/LoginForm'
import Navbar from '@/components/Navbar'

export default async function RegisterPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-surface-900 font-body">
      <Navbar variant="marketing" />
      <div className="flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-bold text-fg-primary">Create your account</h1>
            <p className="mt-2 text-fg-secondary">Start building for free. Just your school email.</p>
          </div>
          <LoginForm />
          <p className="mt-6 text-center text-sm text-fg-muted">
            Already have an account?{' '}
            <a href="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
