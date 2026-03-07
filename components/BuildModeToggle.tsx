'use client'

import { useState } from 'react'

interface BuildModeToggleProps {
  userId: string
  initialEnabled: boolean
}

export default function BuildModeToggle({ userId, initialEnabled }: BuildModeToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, buildModeEnabled: next }),
      })
      if (!res.ok) {
        setEnabled(!next)
        setError('Failed')
      }
    } catch {
      setEnabled(!next)
      setError('Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      aria-pressed={enabled}
      title={enabled ? 'Build mode on — click to disable' : 'Build mode off — click to enable'}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? 'bg-indigo-600' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
      {error && <span className="sr-only">{error}</span>}
    </button>
  )
}
