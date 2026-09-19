import AppSidebar from '@/components/AppSidebar'
import Navbar from '@/components/Navbar'

// Cream frame, sidebar straight on the cream, content in one inset white panel.
export default function AppShell({
  userEmail,
  pageTitle,
  children,
}: {
  userEmail: string
  pageTitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen gap-3 bg-surface-900 p-3 font-body">
      <AppSidebar userEmail={userEmail} />
      <div className="min-w-0 flex-1 rounded-3xl border border-border/60 bg-card shadow-sm">
        <Navbar variant="app" withSidebar pageTitle={pageTitle} userEmail={userEmail} />
        <main className="mx-auto max-w-5xl space-y-10 px-6 py-10 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
