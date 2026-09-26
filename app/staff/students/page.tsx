import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/auth/permissions'
import StudentsClient from './StudentsClient'
import { loadStudents } from './students-data'
import { getSessionUser } from '@/lib/auth/session'

export default async function StudentsPage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'students:manage'))) redirect('/staff')

  const { rows, classes } = await loadStudents(user.orgId)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Students</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage accounts, classes, and invoices
        </p>
      </div>
      <StudentsClient rows={rows} classes={classes} />
    </div>
  )
}
