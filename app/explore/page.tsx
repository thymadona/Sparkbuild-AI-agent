import { desc, eq } from 'drizzle-orm'
import ExploreClient, { type ExploreProject } from './ExploreClient'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { projects as projectsTable } from '@/lib/db/schema'

export default async function ExplorePage() {
  const [projects, user] = await Promise.all([
    // This page is public, so `is_public` is the entire access control — it
    // is not a convenience filter. It used to be enforced twice: by this
    // predicate and by an RLS policy on the anon key. The connection now runs
    // as the table owner and bypasses RLS, so this `where` is the only thing
    // standing between a private project and the open internet. Do not remove
    // it, and do not widen the select to columns a stranger shouldn't read.
    db
      .select({
        id: projectsTable.id,
        title: projectsTable.title,
        lesson_id: projectsTable.lessonId,
        created_at: projectsTable.createdAt,
        files: projectsTable.files,
      })
      .from(projectsTable)
      .where(eq(projectsTable.isPublic, true))
      .orderBy(desc(projectsTable.createdAt))
      .limit(60),
    getSessionUser(),
  ])

  // created_at is nullable in the schema (it carries a default rather than a
  // NOT NULL), so it is normalised here instead of loosening the prop type.
  const rows: ExploreProject[] = projects.map((p) => ({
    ...p,
    files: p.files as ExploreProject['files'],
    created_at: p.created_at ?? '',
  }))

  return <ExploreClient projects={rows} isLoggedIn={!!user} userEmail={user?.email ?? ''} />
}
