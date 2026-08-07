import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/auth/permissions'
import OverviewTab from './OverviewTab'

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
// PII surface with no per-class scoping, so it stays admin-only — a
// teacher's meaningful landing page is their own class list, same as
// today's /teacher route.
export default async function StaffOverviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(user.id))) redirect('/staff/classes')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your school</p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <OverviewTab />
      </Suspense>
    </div>
  )
}
