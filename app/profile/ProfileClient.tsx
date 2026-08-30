'use client'

import { useState } from 'react'

interface Props {
  email: string
  initialName: string
}

export default function ProfileClient({ email, initialName }: Props) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name }),
    })

    setSaving(false)
    if (res.ok) {
      setSaved(true)
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not save your name')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Profile</h1>
        <a
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Back to Dashboard
        </a>
      </header>

      <main className="mx-auto max-w-md px-6 py-12">
        <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <div className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded px-3 py-2">
              {email}
            </div>
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm text-gray-400 mb-1">
              Full Name
            </label>
            <input
              id="full_name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false) }}
              placeholder="Your full name"
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {saved && <p className="text-sm text-green-400">Saved.</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </main>
    </div>
  )
}
