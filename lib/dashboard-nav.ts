// Declarative nav config for the unified /staff dashboard. Each item names
// the permission flag that unlocks it; DashboardShell filters against a
// caller-supplied StaffPermissions rather than a role name, so a future
// role (e.g. a billing clerk) shows the right items just by being granted
// the matching permission — no nav code changes required.

export interface StaffPermissions {
  isAdmin: boolean
  canManageClasses: boolean
  canManageStudents: boolean
  canManageInvoices: boolean
  canManageRoles: boolean
  canManageTelegram: boolean
  // True for any user (admin or otherwise) who is a class_members teacher
  // row on at least one class. Distinct from canManageClasses: it grants
  // scoped access to *their own* classes, not the full roster.
  isTeacherOfAnyClass: boolean
}

export type NavIcon = 'grid' | 'people' | 'book' | 'check' | 'card' | 'send' | 'shield'

export interface NavItem {
  href: string
  label: string
  icon: NavIcon
  exact?: boolean
  visible: (perm: StaffPermissions) => boolean
}

export const STAFF_NAV: NavItem[] = [
  { href: '/staff', label: 'Overview', icon: 'grid', exact: true, visible: () => true },
  {
    href: '/staff/classes',
    label: 'Classes',
    icon: 'book',
    visible: (p) => p.canManageClasses || p.isTeacherOfAnyClass,
  },
  { href: '/staff/students', label: 'Students', icon: 'people', visible: (p) => p.canManageStudents },
  // The global cross-class queue — teachers review homework scoped to their
  // own class from the Classes tab instead, matching existing behavior.
  { href: '/staff/homework', label: 'Homework', icon: 'check', visible: (p) => p.isAdmin },
  { href: '/staff/finance', label: 'Billing', icon: 'card', visible: (p) => p.canManageInvoices },
  { href: '/staff/telegram', label: 'Telegram', icon: 'send', visible: (p) => p.canManageTelegram },
  { href: '/staff/users', label: 'People & Roles', icon: 'shield', visible: (p) => p.canManageRoles },
]
