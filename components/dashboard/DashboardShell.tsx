'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Building2Icon,
  GraduationCapIcon,
  LayoutGridIcon,
  ReceiptIcon,
  SendIcon,
  ShieldCheckIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  GROUP_LABEL,
  STAFF_NAV,
  hasStaffAccess,
  type NavIcon,
  type StaffPermissions,
} from '@/lib/dashboard-nav'

const COLLAPSE_KEY = 'staff-sidebar-collapsed'

// One lucide icon per nav entry (lib/dashboard-nav.ts names them).
const ICONS: Record<NavIcon, LucideIcon> = {
  grid: LayoutGridIcon,
  building: Building2Icon,
  people: UsersIcon,
  book: GraduationCapIcon,
  card: ReceiptIcon,
  send: SendIcon,
  shield: ShieldCheckIcon,
}

function Icon({ name }: { name: NavIcon }) {
  const Glyph = ICONS[name]
  return <Glyph className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
    </svg>
  )
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
  // A platform owner with no org role has only /console to go to.
  const homeHref = hasStaffAccess(permissions) ? '/staff' : '/console/orgs'
  const [collapsed, setCollapsed] = useState(false)

  // Read the saved preference after mount so server and first client render
  // match (no hydration mismatch); a brief flash to the saved state is fine.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const asideWidth = collapsed ? 'w-14' : 'w-56'
  const contentMargin = collapsed ? 'ml-14' : 'ml-56'

  return (
    <div className="staff-shell min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex ${asideWidth} flex-col border-r border-border bg-card py-3 transition-[width] duration-150`}
      >
        <Link
          href={homeHref}
          title="Back office"
          className={`mb-3 flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-4'}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary">
            <svg
              className="h-4 w-4 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </span>
          {!collapsed && (
            <span className="truncate font-semibold text-sm text-foreground">Staff</span>
          )}
        </Link>

        <nav
          className={`flex flex-1 flex-col gap-0.5 overflow-y-auto ${collapsed ? 'items-center' : 'px-2'}`}
        >
          {items.map((item, i) => {
            const prev = items[i - 1]
            const newGroup = item.group && prev?.group !== item.group
            const active = isActive(item.href, item.exact)
            return (
              <div key={item.href} className="contents">
                {newGroup &&
                  (collapsed ? (
                    prev && <div className="my-2 h-px w-6 shrink-0 bg-border" />
                  ) : (
                    <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                      {GROUP_LABEL[item.group!]}
                    </p>
                  ))}
                <Link
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-3 rounded-md text-sm transition-colors ${
                    collapsed ? 'h-10 w-10 justify-center' : 'px-3 py-2'
                  } ${
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon name={item.icon} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </div>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`mt-2 flex h-9 items-center gap-2 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            collapsed ? 'w-10 justify-center self-center' : 'mx-2 px-3'
          }`}
        >
          <ChevronIcon collapsed={collapsed} />
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </aside>

      <div
        className={`${contentMargin} flex min-h-screen flex-col transition-[margin] duration-150`}
      >
        <header className="sticky top-0 z-30 flex h-12 items-center justify-end gap-3 border-b border-border bg-card px-4">
          <span className="truncate text-xs text-muted-foreground max-w-[16rem]">
            {roleLabel ? `${email} · ${roleLabel}` : email}
          </span>
          <Link
            href="/lessons"
            title="Back to app"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              viewBox="0 0 24 24"
            >
              <path d="M3 12l9-9 9 9" />
              <path d="M5 10v10h14V10" />
            </svg>
          </Link>
        </header>
        <main className="flex-1 mx-auto w-full max-w-7xl px-8 py-6">{children}</main>
      </div>
    </div>
  )
}
