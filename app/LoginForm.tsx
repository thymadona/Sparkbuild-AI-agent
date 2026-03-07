'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserSupabaseClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-green-800 bg-green-950 p-6 text-center">
        <p className="text-green-300 font-medium">Check your email!</p>
        <p className="mt-1 text-sm text-green-400">
          We sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Sending...' : 'Send magic link'}
      </button>
      <p className="text-center text-xs text-gray-500">
        No password needed. We&apos;ll email you a sign-in link.
      </p>
    </form>
  )
}
