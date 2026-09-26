import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { isPlatformAdmin } from '@/lib/auth/permissions'

export const maxDuration = 20

// The platform owner's console: every org, across tenants. proxy.ts gates the
// navigation; this re-checks, because a layout is not reached only through
// proxy. It becomes the console. host in D2.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!(await isPlatformAdmin(user.id))) redirect('/lessons')

  return (
    <div className="staff-shell min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="font-semibold">SparkBuild console</span>
          <div className="flex min-w-0 items-center gap-4 text-sm">
            <span className="hidden truncate text-muted-foreground sm:inline">{user.email}</span>
            <Link href="/staff" className="text-primary hover:underline">
              Back office
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
