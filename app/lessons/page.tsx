import { redirect } from 'next/navigation'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { LESSONS } from '@/lib/lessons'
import { getEnabledLessonIdsForUser } from '@/lib/lesson-availability'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import LessonsClient from './LessonsClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function LessonsPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/')
  }

  const [userProjects, enabledLessonIds, admin, teacher] = await Promise.all([
    db
      .select({
        id: projects.id,
        lesson_id: projects.lessonId,
        updated_at: projects.updatedAt,
      })
      .from(projects)
      .where(and(eq(projects.userId, user.id), isNotNull(projects.lessonId)))
      .orderBy(desc(projects.updatedAt)),
    getEnabledLessonIdsForUser(user.id),
    isAdmin(user.id),
    isTeacher(user.id),
  ])

  // Admins and teachers previewing the catalog aren't gated by the
  // per-class toggle — that toggle exists to control student access, and a
  // teacher assigned to no class (or none yet) should still see and open
  // lessons — same posture as rate limiting.
  const enabledIds = admin || teacher ? LESSONS.map((l) => l.id) : Array.from(enabledLessonIds)

  return (
    <LessonsClient
      lessons={LESSONS}
      userProjects={userProjects}
      enabledLessonIds={enabledIds}
      userEmail={user.email ?? ''}
    />
  )
}
