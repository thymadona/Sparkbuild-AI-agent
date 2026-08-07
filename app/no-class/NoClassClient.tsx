'use client'

import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

export default function NoClassClient({ email }: { email: string }) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-4 text-4xl">🎒</div>
        <h1 className="text-2xl font-bold">You&apos;re not in a class yet</h1>
        <p className="mt-2 text-gray-500">
          Ask your teacher or school admin to add {email} to a class. You&apos;ll get access
          as soon as they do.
        </p>
        <button
          onClick={handleSignOut}
          className="mt-6 text-sm text-gray-500 underline hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
