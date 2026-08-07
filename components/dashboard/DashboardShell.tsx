'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { STAFF_NAV, type NavIcon, type StaffPermissions } from '@/lib/dashboard-nav'

function Icon({ name }: { name: NavIcon }) {
  const common = { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, viewBox: '0 0 24 24' }
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'people':
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      )
    case 'card':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      )
    case 'send':
      return (
        <svg {...common}>
          <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )
  }
}

interface Props {
  email: string
  roleLabel: string
  permissions: StaffPermissions
  children: React.ReactNode
}

export default function DashboardShell({ email, roleLabel, permissions, children }: Props) {
  const pathname = usePathname()
  const items = STAFF_NAV.filter((item) => item.visible(permissions))

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-gray-800 bg-gray-950">
        <div className="flex h-14 items-center gap-2.5 border-b border-gray-800 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-semibold text-gray-100 text-sm">School Staff</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {items.map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-gray-800 text-gray-100'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-800 px-4 py-3">
          <p className="truncate text-xs text-gray-500">{email}</p>
          <p className="mt-0.5 text-xs text-gray-600">{roleLabel}</p>
          <a href="/dashboard" className="mt-1 block text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Back to app
          </a>
        </div>
      </aside>
      <main className="ml-56 min-h-screen">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  )
}
