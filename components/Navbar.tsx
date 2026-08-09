'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import ProfileDropdown from './ProfileDropdown'

const LINKS = [
  { href: '/lessons', label: 'Lessons' },
  { href: '/explore', label: 'Explore' },
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
      className={`z-50 w-full border-b-2 border-surface-600 bg-surface-900/90 backdrop-blur-md ${
        variant === 'marketing' ? 'fixed top-0' : 'sticky top-0'
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link
          href={variant === 'app' ? '/dashboard' : '/'}
          className={`font-display text-lg font-bold text-fg-primary ${collapseAtLg}`}
        >
          <span className="text-brand-600 dark:text-brand-400">Code</span>Builder
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
                    ? 'border-b-2 border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-b-2 border-transparent text-fg-secondary hover:text-fg-primary'
                }`}
              >
                {label}
              </Link>
            )
          })}
          <ThemeToggle />
          {variant === 'marketing' ? (
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className="rounded-lg border-2 border-surface-600 bg-brand-500 px-4 py-2 font-display text-sm font-bold text-white shadow-hard-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
