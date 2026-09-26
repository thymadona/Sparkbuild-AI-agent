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
  // The platform owner: shows the link out to /console. Not an org power.
  isPlatformAdmin: boolean
}

// The permission keys the sidebar switches on. Both app/staff/layout.tsx and
// app/staff/page.tsx pass this exact list to getStaffContext, which keys its
// cache entry on it — so the page reads the entry the layout just populated
// instead of issuing its own query. Adding a key here costs no round trip.
export const NAV_PERMISSION_KEYS = [
  'classes:manage',
  'students:manage',
  'invoices:manage',
  'roles:manage',
  'telegram:manage',
] as const

export type NavIcon = 'grid' | 'people' | 'book' | 'check' | 'card' | 'send' | 'shield'

export type NavGroup = 'classes' | 'people' | 'billing'

export interface NavItem {
  href: string
  label: string
  icon: NavIcon
  exact?: boolean
  // Omitted = renders ungrouped, above any group headers (just Overview today).
  group?: NavGroup
  visible: (perm: StaffPermissions) => boolean
}

export const GROUP_LABEL: Record<NavGroup, string> = {
  classes: 'Classes',
  people: 'People',
  billing: 'Billing & Integrations',
}

export const STAFF_NAV: NavItem[] = [
  { href: '/staff', label: 'Overview', icon: 'grid', exact: true, visible: () => true },
  {
    href: '/console',
    label: 'Platform console',
    icon: 'shield',
    visible: (p) => p.isPlatformAdmin,
  },
  {
    href: '/staff/classes',
    label: 'Classes',
    icon: 'book',
    group: 'classes',
    visible: (p) => p.canManageClasses || p.isTeacherOfAnyClass,
  },
  {
    href: '/staff/students',
    label: 'Students',
    icon: 'people',
    group: 'people',
    visible: (p) => p.canManageStudents,
  },
  {
    href: '/staff/users',
    label: 'People & Roles',
    icon: 'shield',
    group: 'people',
    visible: (p) => p.canManageRoles,
  },
  {
    href: '/staff/finance',
    label: 'Billing',
    icon: 'card',
    group: 'billing',
    visible: (p) => p.canManageInvoices,
  },
  {
    href: '/staff/telegram',
    label: 'Telegram',
    icon: 'send',
    group: 'billing',
    visible: (p) => p.canManageTelegram,
  },
]
