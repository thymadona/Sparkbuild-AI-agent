import Navbar from '@/components/Navbar'
import type { AccountLinks } from '@/lib/account-links'

// Cream frame with the content in one inset white panel.
export default function AppShell({
  userEmail,
  xp,
  links,
  children,
}: {
  userEmail: string
  xp?: number
  links?: AccountLinks
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-900 p-3 font-body">
      <div className="mx-auto min-w-0 max-w-5xl rounded-3xl border border-border/60 bg-card shadow-sm">
        <Navbar variant="app" userEmail={userEmail} xp={xp} links={links} />
        <main className="space-y-10 px-6 py-10 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
