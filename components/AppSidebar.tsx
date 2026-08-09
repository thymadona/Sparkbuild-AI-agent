'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, Users, User as UserIcon } from 'lucide-react'

// bg-secondary's dark-mode CSS var (#ffb1c5) is a pale pastel meant for
// small accents, not a filled active-nav pill — on the dark surface it
// washes out. Override with the same deeper rose used on /lessons.
const ACCENT_BG = 'bg-secondary dark:bg-[#b3305f]'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/lessons', label: 'Roadmap', icon: Map },
  { href: '/explore', label: 'Community', icon: Users },
  { href: '/profile', label: 'Profile', icon: UserIcon },
]

export default function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const initials = userEmail[0]?.toUpperCase() ?? '?'
  const username = userEmail.split('@')[0] || 'Student'

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-6 border-r-2 border-surface-600 bg-surface-800 p-5">
      <div className="flex items-center gap-3 rounded-xl border-2 border-surface-600 bg-surface-900 p-3 shadow-hard-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-surface-600 bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-fg-primary">{username}</p>
          <p className="text-xs text-fg-muted">Student</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                active
                  ? `border-surface-600 ${ACCENT_BG} text-white shadow-hard-sm`
                  : 'border-transparent text-fg-secondary hover:border-surface-600 hover:bg-surface-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
