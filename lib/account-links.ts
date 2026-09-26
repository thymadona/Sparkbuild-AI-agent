import { getStaffContext, isPlatformAdmin } from '@/lib/auth/permissions'
import { NAV_PERMISSION_KEYS } from '@/lib/dashboard-nav'

// Which back-office areas the profile menu links to. Mirrors the gates they
// sit behind: /staff lets in any admin or anyone who teaches a class
// (app/staff/layout.tsx), /console only the platform owner. Both helpers fail
// closed and are cached, and getStaffContext is keyed on the same list the
// /staff layout uses, so this shares its cache entry. A link is a
// convenience only; each area still checks on entry.
export interface AccountLinks {
  staff: boolean
  console: boolean
}

export async function getAccountLinks(userId: string): Promise<AccountLinks> {
  const [ctx, platformAdmin] = await Promise.all([
    getStaffContext(userId, NAV_PERMISSION_KEYS),
    isPlatformAdmin(userId),
  ])
  return { staff: ctx.isAdmin || ctx.teacherClassIds.length > 0, console: platformAdmin }
}
