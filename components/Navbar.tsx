'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ProfileDropdown from './ProfileDropdown'
import Logo from './Logo'

const LINKS = [
  { href: '/lessons', label: 'Lessons' },
]

interface NavbarProps {
  /** 'marketing' floats over a hero (fixed + blur); 'app' docks inline (sticky). */
  variant?: 'marketing' | 'app'
  /** marketing only: swaps the Sign in CTA for a Dashboard link. */
  isLoggedIn?: boolean
  /** app only: renders the account menu when present. */
  userEmail?: string
  /** app only: this page also renders AppSidebar — collapse the links/logo this bar
   * would otherwise duplicate once the sidebar takes over at the lg breakpoint. */
  withSidebar?: boolean
  /** app + withSidebar: shown in place of the logo once the sidebar is visible. */
  pageTitle?: string
}

export default function Navbar({
  variant = 'marketing',
  isLoggedIn = false,
  userEmail,
  withSidebar = false,
  pageTitle,
}: NavbarProps) {
  const pathname = usePathname()
  const collapseAtLg = withSidebar ? 'lg:hidden' : ''

  return (
    <header
      className={`z-50 w-full backdrop-blur-md ${
        variant === 'marketing' ? 'fixed top-0 border-b border-border bg-surface-900/90' : 'sticky top-0 rounded-t-3xl border-b border-border/60 bg-card/90'
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link
          href={variant === 'app' ? '/dashboard' : '/'}
          className={`flex items-center gap-2 font-display text-xl font-extrabold text-fg-primary ${collapseAtLg}`}
        >
          <Logo className="h-10 w-10" />
          <span>
            <span className="text-spark">Spark</span>Build
          </span>
        </Link>
        {withSidebar && pageTitle && (
          <span className="hidden font-display text-lg font-bold text-fg-primary lg:block">{pageTitle}</span>
        )}

        <div className="flex items-center gap-4 text-sm">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`hidden pb-0.5 font-semibold transition-colors sm:block ${collapseAtLg} ${
                  active
                    ? 'border-b-2 border-brand-600 text-brand-600 '
                    : 'border-b-2 border-transparent text-fg-secondary hover:text-fg-primary'
                }`}
              >
                {label}
              </Link>
            )
          })}
          {variant === 'marketing' ? (
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className="btn-primary"
            >
              {isLoggedIn ? 'Dashboard' : 'Sign in'}
            </Link>
          ) : (
            userEmail && <ProfileDropdown email={userEmail} />
          )}
        </div>
      </nav>
    </header>
  )
}
