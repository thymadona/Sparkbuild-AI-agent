import { redirect } from 'next/navigation'
import { getStaffContext } from '@/lib/auth/permissions'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { NAV_PERMISSION_KEYS, type StaffPermissions } from '@/lib/dashboard-nav'
import { getSessionUser } from '@/lib/auth/session'

// A wedged request should fail fast and visibly rather than burn the
// platform's default budget (300s on Vercel) behind a spinner that never
// resolves. Nothing here legitimately takes 20s; lib/db/client.ts sets a 15s
// statement_timeout, and this is the outer bound on top of it.
export const maxDuration = 20

// This layout only decides who may enter the /staff shell at all (any
// admin, or anyone who teaches at least one class) and what the sidebar
// shows them. It is NOT a substitute for each page's own authorization
// check — a page whose data isn't scoped to "classes I teach" (students,
// finance, telegram, users, the global homework queue) must still verify
// its own required permission, exactly as CLAUDE.md requires for every
// admin route. Nav visibility here is a convenience, not an access
// boundary.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // One round trip, not seven — see getStaffContext for why that matters on
  // this particular layout.
  const ctx = await getStaffContext(user.id, NAV_PERMISSION_KEYS)

  const permissions: StaffPermissions = {
    isAdmin: ctx.isAdmin,
    canManageClasses: ctx.permissions['classes:manage'],
    canManageStudents: ctx.permissions['students:manage'],
    canManageInvoices: ctx.permissions['invoices:manage'],
    canManageRoles: ctx.permissions['roles:manage'],
    canManageTelegram: ctx.permissions['telegram:manage'],
    isTeacherOfAnyClass: ctx.teacherClassIds.length > 0,
  }

  if (!ctx.isAdmin && !permissions.isTeacherOfAnyClass) redirect('/dashboard')

  return (
    <DashboardShell
      email={user.email ?? ''}
      roleLabel={ctx.isAdmin ? 'Admin' : 'Teacher'}
      permissions={permissions}
    >
      {children}
    </DashboardShell>
  )
}
