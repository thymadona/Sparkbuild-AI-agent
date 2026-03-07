'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ForkButton({ projectId }: { projectId: string }) {
  const [forking, setForking] = useState(false)
  const router = useRouter()

  async function handleFork() {
    setForking(true)
    const res = await fetch('/api/projects/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: projectId }),
    })
    const copy = await res.json()
    setForking(false)
    if (copy.id) {
      router.push(`/editor/${copy.id}`)
    } else if (copy.error === 'Unauthorized') {
      router.push(`/login?next=/share/${projectId}`)
    }
  }

  return (
    <button
      onClick={handleFork}
      disabled={forking}
      className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
    >
      {forking ? 'Forking...' : 'Fork'}
    </button>
  )
}
