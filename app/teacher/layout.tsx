import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin, getTeacherClassIds } from '@/lib/auth/permissions'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await isAdmin(user.id))) {
    const classIds = await getTeacherClassIds(user.id)
    if (classIds.length === 0) redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 px-8 py-4">
        <span className="font-semibold text-gray-100 text-sm">Teacher Dashboard</span>
      </div>
      <main className="px-8 py-6">{children}</main>
    </div>
  )
}
