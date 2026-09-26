import { redirect } from 'next/navigation'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { lessonProgress, projects } from '@/lib/db/schema'
import { LESSONS } from '@/lib/lessons'
import { getPlayerStats } from '@/lib/player-stats'
import { accessPolicyFor, getAvailableLessonIdsForUser } from '@/lib/lesson-availability'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { getAccountLinks } from '@/lib/account-links'
import { loadMyInvites } from '@/lib/org-invites'
import LessonsClient from './LessonsClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function LessonsPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/')
  }

  const [userProjects, availableLessonIds, admin, teacher, stats, links, invites] =
    await Promise.all([
      db
        .select({
          id: projects.id,
          lesson_id: projects.lessonId,
          updated_at: projects.updatedAt,
          done: lessonProgress.completedTaskIds,
        })
        .from(projects)
        .leftJoin(lessonProgress, eq(lessonProgress.projectId, projects.id))
        .where(and(eq(projects.userId, user.id), isNotNull(projects.lessonId)))
        .orderBy(desc(projects.updatedAt)),
      getAvailableLessonIdsForUser(user.id, user.orgId),
      isAdmin(user.id),
      isTeacher(user.id),
      getPlayerStats(user.id),
      getAccountLinks(user.id),
      // A banner, not the page: never let it break /lessons.
      loadMyInvites(user).catch((err) => {
        console.error('loadMyInvites failed:', err)
        return []
      }),
    ])

  // Admins and teachers previewing the catalog aren't gated — the lesson
  // order and the per-class toggle exist to pace students, and a teacher
  // assigned to no class (or none yet) should still see and open lessons —
  // same posture as rate limiting.
  const enabledIds = admin || teacher ? LESSONS.map((l) => l.id) : Array.from(availableLessonIds)

  return (
    <LessonsClient
      lessons={LESSONS}
      userProjects={userProjects.map((p) => ({ ...p, done: p.done?.length ?? 0 }))}
      enabledLessonIds={enabledIds}
      policy={accessPolicyFor(user.orgId)}
      invites={invites}
      userEmail={user.email ?? ''}
      stats={stats}
      links={links}
    />
  )
}
