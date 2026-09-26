import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/auth/permissions'
import CreateStudentModal from '@/components/admin/CreateStudentModal'
import PageHeader from '@/components/dashboard/PageHeader'
import StudentsClient from './StudentsClient'
import { loadStudents } from './students-data'
import { getSessionUser } from '@/lib/auth/session'

export default async function StudentsPage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'students:manage'))) redirect('/staff')

  const { rows, classes } = await loadStudents(user.orgId)

  return (
    <div>
      <PageHeader
        title="Students"
        description="Accounts, classes and payment. Open a student to edit, invoice or deactivate."
        actions={<CreateStudentModal />}
      />
      <StudentsClient rows={rows} classes={classes} />
    </div>
  )
}
