import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { getLessonForProject } from '@/lib/lessons'

// A project the caller owns, together with the lesson it is pinned to. The
// ownership predicate is part of the query rather than a comparison afterwards,
// so it cannot be forgotten further down a handler.
export async function getLessonProject(projectId: string, userId: string) {
  if (!isUuid(projectId)) return null

  const [project] = await db
    .select({
      id: projects.id,
      lesson_id: projects.lessonId,
      lesson_version: projects.lessonVersion,
      board: projects.board,
      files: projects.files,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (!project || project.lesson_id == null) return null
  const lesson = getLessonForProject(project.lesson_id, project.lesson_version)
  return lesson ? { project, lesson } : null
}
