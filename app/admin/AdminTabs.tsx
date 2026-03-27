'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'students', label: 'Students' },
  { id: 'classes', label: 'Classes' },
  { id: 'finance', label: 'Finance' },
] as const

export default function AdminTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = searchParams.get('tab') ?? 'overview'

  function go(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 border-b border-gray-800 mb-6">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => go(t.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === t.id
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
