import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { getSessionUser } from '@/lib/auth/session'
import type { ProjectFiles } from '@/types'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Not ownership-scoped on purpose: a public project can be copied by anyone,
  // which is what /explore and /share are for. The check below is the gate.
  const [source] = await db
    .select({
      title: projects.title,
      files: projects.files,
      is_public: projects.isPublic,
      user_id: projects.userId,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1)

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (source.user_id !== user.id && !source.is_public)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [copy] = await db
      .insert(projects)
      .values({
        userId: user.id,
        title: `Copy of ${source.title}`,
        files: source.files as ProjectFiles,
        isPublic: false,
      })
      .returning({
        id: projects.id,
        user_id: projects.userId,
        title: projects.title,
        files: projects.files,
        is_public: projects.isPublic,
        lesson_id: projects.lessonId,
        lesson_version: projects.lessonVersion,
        submission_status: projects.submissionStatus,
        created_at: projects.createdAt,
        updated_at: projects.updatedAt,
      })

    return NextResponse.json(copy)
  } catch (err) {
    console.error('POST /api/projects/duplicate failed:', err)
    return NextResponse.json({ error: 'Failed to duplicate project' }, { status: 500 })
  }
}
