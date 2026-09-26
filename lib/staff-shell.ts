import { getStaffContext, isPlatformAdmin } from '@/lib/auth/permissions'
import { NAV_PERMISSION_KEYS, type StaffPermissions } from '@/lib/dashboard-nav'

// What the back-office sidebar shows one user. Shared by app/staff/layout.tsx
// and app/console/layout.tsx so both render the same shell and menu. Nav
// visibility is a convenience, not an access boundary: each layout and page
// still does its own check.
export async function loadShellPermissions(userId: string): Promise<{
  permissions: StaffPermissions
  roleLabel: string
}> {
  const [ctx, platformAdmin] = await Promise.all([
    getStaffContext(userId, NAV_PERMISSION_KEYS),
    isPlatformAdmin(userId),
  ])

  const permissions: StaffPermissions = {
    isAdmin: ctx.isAdmin,
    canManageClasses: ctx.permissions['classes:manage'],
    canManageStudents: ctx.permissions['students:manage'],
    canManageInvoices: ctx.permissions['invoices:manage'],
    canManageRoles: ctx.permissions['roles:manage'],
    canManageTelegram: ctx.permissions['telegram:manage'],
    isTeacherOfAnyClass: ctx.teacherClassIds.length > 0,
    isPlatformAdmin: platformAdmin,
  }

  const roleLabel = ctx.isAdmin
    ? 'Admin'
    : permissions.isTeacherOfAnyClass
      ? 'Teacher'
      : platformAdmin
        ? 'Platform owner'
        : ''

  return { permissions, roleLabel }
}
