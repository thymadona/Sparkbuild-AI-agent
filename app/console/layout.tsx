import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { getSessionUser } from '@/lib/auth/session'
import { loadShellPermissions } from '@/lib/staff-shell'

export const maxDuration = 20

// The platform owner's console: every org, across tenants. It renders in the
// same shell as /staff, as the sidebar's "All Organizations" group. proxy.ts
// gates the navigation; this re-checks, because a layout is not reached only
// through proxy. It becomes the console. host in D9.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { permissions, roleLabel } = await loadShellPermissions(user.id)
  if (!permissions.isPlatformAdmin) redirect('/lessons')

  return (
    <DashboardShell email={user.email ?? ''} roleLabel={roleLabel} permissions={permissions}>
      {children}
    </DashboardShell>
  )
}
