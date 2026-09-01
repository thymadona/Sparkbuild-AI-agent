import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getStaffContext } from '@/lib/auth/permissions'
import OverviewTab from './OverviewTab'
import TeacherOverviewTab from './TeacherOverviewTab'
import OverviewSkeleton from './OverviewSkeleton'
import { NAV_PERMISSION_KEYS } from '@/lib/dashboard-nav'
import { getSessionUser } from '@/lib/auth/session'

// The whole-school overview (every user's request/project counts) is a
// PII surface with no per-class scoping, so it's admin-only; a teacher
// instead gets TeacherOverviewTab, scoped to just the classes they teach
// (StaffLayout already guarantees a non-admin here teaches at least one).
export default async function StaffOverviewPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Same arguments as StaffLayout, so this hits the cache entry the layout
  // just populated instead of issuing its own query. With no Redis, cached()
  // falls through and this costs one round trip, as it always did.
  // getSessionUser above is deduped with the layout's call by React cache().
  const { isAdmin: admin } = await getStaffContext(user.id, NAV_PERMISSION_KEYS)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {admin ? 'Overview of your school' : 'Overview of your classes'}
        </p>
      </div>
      <Suspense fallback={<OverviewSkeleton />}>
        {admin ? <OverviewTab /> : <TeacherOverviewTab userId={user.id} />}
      </Suspense>
    </div>
  )
}
