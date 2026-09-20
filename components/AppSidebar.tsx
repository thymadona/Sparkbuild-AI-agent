'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, User as UserIcon } from 'lucide-react'
import Logo from '@/components/Logo'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/lessons', label: 'Roadmap', icon: Map },
  { href: '/profile', label: 'Profile', icon: UserIcon },
]

export default function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const initials = userEmail[0]?.toUpperCase() ?? '?'
  const username = userEmail.split('@')[0] || 'Student'

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-2 px-2 py-3">
      <Link href="/dashboard" className="mb-4 flex items-center justify-start gap-2 px-3 font-display text-xl font-extrabold text-fg-primary">
        <Logo className="h-9 w-9" />
        <span><span className="text-spark">Spark</span>Build</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-fg-primary transition-colors ${
                active
                  ? 'border-transparent bg-secondary/70 shadow-sm'
                  : 'border-border/60 bg-card/70 hover:bg-card'
              }`}
            >
              <Icon className="h-4 w-4 text-fg-secondary" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-fg-primary">{username}</p>
          <p className="text-xs text-fg-muted">Student</p>
        </div>
      </div>
    </aside>
  )
}
