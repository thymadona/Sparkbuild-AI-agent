import { redirect } from 'next/navigation'
import { isAdmin, getTeacherClassIds } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!(await isAdmin(user.id))) {
    const classIds = await getTeacherClassIds(user.id)
    if (classIds.length === 0) redirect('/lessons')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border px-8 py-4">
        <span className="font-semibold text-foreground text-sm">Teacher Dashboard</span>
      </div>
      <main className="px-8 py-6">{children}</main>
    </div>
  )
}
