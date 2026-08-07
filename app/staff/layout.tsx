import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin, hasPermission, getTeacherClassIds } from '@/lib/auth/permissions'
import DashboardShell from '@/components/dashboard/DashboardShell'
import type { StaffPermissions } from '@/lib/dashboard-nav'

// This layout only decides who may enter the /staff shell at all (any
// admin, or anyone who teaches at least one class) and what the sidebar
// shows them. It is NOT a substitute for each page's own authorization
// check — a page whose data isn't scoped to "classes I teach" (students,
// finance, telegram, users, the global homework queue) must still verify
// its own required permission, exactly as CLAUDE.md requires for every
// admin route. Nav visibility here is a convenience, not an access
// boundary.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [admin, canManageClasses, canManageStudents, canManageInvoices, canManageRoles, canManageTelegram, teacherClassIds] =
    await Promise.all([
      isAdmin(user.id),
      hasPermission(user.id, 'classes:manage'),
      hasPermission(user.id, 'students:manage'),
      hasPermission(user.id, 'invoices:manage'),
      hasPermission(user.id, 'roles:manage'),
      hasPermission(user.id, 'telegram:manage'),
      getTeacherClassIds(user.id),
    ])

  const permissions: StaffPermissions = {
    isAdmin: admin,
    canManageClasses,
    canManageStudents,
    canManageInvoices,
    canManageRoles,
    canManageTelegram,
    isTeacherOfAnyClass: teacherClassIds.length > 0,
  }

  if (!admin && !permissions.isTeacherOfAnyClass) redirect('/dashboard')

  return (
    <DashboardShell email={user.email ?? ''} roleLabel={admin ? 'Admin' : 'Teacher'} permissions={permissions}>
      {children}
    </DashboardShell>
  )
}
