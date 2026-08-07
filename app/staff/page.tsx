import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/auth/permissions'
import OverviewTab from './OverviewTab'
import TeacherOverviewTab from './TeacherOverviewTab'

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
    </div>
  )
}

// The whole-school overview (every user's request/project counts) is a
// PII surface with no per-class scoping, so it's admin-only; a teacher
// instead gets TeacherOverviewTab, scoped to just the classes they teach
// (StaffLayout already guarantees a non-admin here teaches at least one).
export default async function StaffOverviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = await isAdmin(user.id)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {admin ? 'Overview of your school' : 'Overview of your classes'}
        </p>
      </div>
      <Suspense fallback={<Skeleton />}>
        {admin ? <OverviewTab /> : <TeacherOverviewTab userId={user.id} />}
      </Suspense>
    </div>
  )
}
