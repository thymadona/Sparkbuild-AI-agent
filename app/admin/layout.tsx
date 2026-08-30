import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth/permissions'
import AdminSidebar from './AdminSidebar'
import { getSessionUser } from '@/lib/auth/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!(await isAdmin(user.id))) redirect('/dashboard')

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
