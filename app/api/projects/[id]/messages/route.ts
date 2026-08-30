import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { messages as messagesTable, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { getSessionUser } from '@/lib/auth/session'

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Ownership is checked as a predicate rather than by comparing the fetched
  // row, so a project belonging to someone else yields no rows at all.
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, user.id)))
    .limit(1)

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // snake_case keys: this shape is what types/index.ts and the client
  // components consume. See the naming note in CLAUDE.md.
  const messages = await db
    .select({
      id: messagesTable.id,
      project_id: messagesTable.projectId,
      user_id: messagesTable.userId,
      role: messagesTable.role,
      content: messagesTable.content,
      created_at: messagesTable.createdAt,
    })
    .from(messagesTable)
    .where(eq(messagesTable.projectId, params.id))
    .orderBy(asc(messagesTable.createdAt))
    .limit(100)

  return NextResponse.json({ messages })
}
