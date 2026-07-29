import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminSidebar from './AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  if (!allowed.includes(user.email?.toLowerCase() ?? '')) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <AdminSidebar email={user.email ?? ''} />
      <main className="ml-56 min-h-screen">
        <div className="px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
