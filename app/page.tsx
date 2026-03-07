import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import LoginForm from './LoginForm'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Student Code Builder
          </h1>
          <p className="mt-3 text-gray-400">
            Type a prompt. Get a live web app. No setup needed.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
