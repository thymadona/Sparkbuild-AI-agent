import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { getEnabledLessonIdsForUser } from '@/lib/lesson-availability'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { LESSONS } from '@/lib/lessons'
import DashboardClient from './DashboardClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function DashboardPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/')
  }

  const [projectRows, enabledLessonIds, admin, teacher] = await Promise.all([
    db
      .select({
        id: projects.id,
        title: projects.title,
        lesson_id: projects.lessonId,
        updated_at: projects.updatedAt,
        is_public: projects.isPublic,
      })
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.updatedAt)),
    getEnabledLessonIdsForUser(user.id),
    isAdmin(user.id),
    isTeacher(user.id),
  ])

  // Same bypass as the lessons catalog: a teacher/admin previewing isn't
  // gated by the per-class toggle meant to control student access.
  const enabledIds = admin || teacher ? LESSONS.map((l) => l.id) : Array.from(enabledLessonIds)

  return (
    <DashboardClient
      initialProjects={projectRows}
      userEmail={user.email ?? ''}
      enabledLessonIds={enabledIds}
    />
  )
}
