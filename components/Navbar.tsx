'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'
import ProfileDropdown from './ProfileDropdown'
import Logo from './Logo'
import type { AccountLinks } from '@/lib/account-links'

interface NavbarProps {
  /** 'marketing' floats over a hero (fixed + blur); 'app' docks inline (sticky). */
  variant?: 'marketing' | 'app'
  /** marketing only: swaps the Sign in CTA for a Dashboard link. */
  isLoggedIn?: boolean
  /** app only: renders the account menu when present. */
  userEmail?: string
  /** app only: total course XP, shown beside the account menu. */
  xp?: number
  /** app only: the back-office areas the account menu links to. */
  links?: AccountLinks
}

export default function Navbar({
  variant = 'marketing',
  isLoggedIn = false,
  userEmail,
  xp,
  links,
}: NavbarProps) {
  return (
    <header
      className={`z-50 w-full backdrop-blur-md ${
        variant === 'marketing'
          ? 'fixed top-0 border-b border-border bg-surface-900/90'
          : 'sticky top-0 rounded-t-3xl border-b border-border/60 bg-card/90'
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link
          href={variant === 'app' ? '/lessons' : '/'}
          className={`flex items-center gap-2 font-display text-xl font-extrabold text-fg-primary `}
        >
          <Logo className="h-10 w-10" />
          <span>
            <span className="text-spark">Spark</span>Build
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {variant === 'marketing' ? (
            <Link href={isLoggedIn ? '/lessons' : '/login'} className="btn-primary">
              {isLoggedIn ? 'Lessons' : 'Sign in'}
            </Link>
          ) : (
            <>
              {xp !== undefined && (
                <span
                  className="flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1.5 font-display text-sm font-bold text-fg-primary"
                  title="Total XP"
                >
                  <Zap className="size-4 fill-current text-spark" aria-hidden="true" />
                  {xp}
                  <span className="sr-only">XP</span>
                </span>
              )}
              {userEmail && <ProfileDropdown email={userEmail} links={links} />}
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
