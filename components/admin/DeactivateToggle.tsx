'use client'

import { useState } from 'react'

export default function DeactivateToggle({
  userId,
  initialActive,
}: {
  userId: string
  initialActive: boolean
}) {
  const [active, setActive] = useState(initialActive)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/admin/students/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !active }),
    })
    if (res.ok) setActive((v) => !v)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={active ? 'Deactivate account' : 'Reactivate account'}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
        active ? 'bg-green-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 translate-x-0 rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
