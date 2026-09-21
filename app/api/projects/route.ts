import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { messages, projects as projectsTable, prompts } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { CURRENT_LESSON_VERSION, getLessonForProject } from '@/lib/lessons'
import { getEnabledLessonIdsForUser } from '@/lib/lesson-availability'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { SavedBoard } from '@/lib/board/code'
import type { ProjectFiles } from '@/types'

// The full row as the API has always shaped it: snake_case keys, matching
// `Project` in types/index.ts and every client component that reads it. See
// the naming note in CLAUDE.md — these flip to camelCase in one pass, later.
const projectColumns = {
  id: projectsTable.id,
  user_id: projectsTable.userId,
  title: projectsTable.title,
  files: projectsTable.files,
  is_public: projectsTable.isPublic,
  lesson_id: projectsTable.lessonId,
  lesson_version: projectsTable.lessonVersion,
  submission_status: projectsTable.submissionStatus,
  created_at: projectsTable.createdAt,
  updated_at: projectsTable.updatedAt,
}

// GET /api/projects — list all projects for the authenticated user
export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const projects = await db
      .select({
        id: projectsTable.id,
        title: projectsTable.title,
        lesson_id: projectsTable.lessonId,
        updated_at: projectsTable.updatedAt,
        is_public: projectsTable.isPublic,
      })
      .from(projectsTable)
      .where(eq(projectsTable.userId, user.id))
      .orderBy(desc(projectsTable.updatedAt))

    return NextResponse.json(projects)
  } catch (err) {
    console.error('GET /api/projects failed:', err)
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })
  }
}

// POST /api/projects — start a lesson. Every project belongs to a lesson on
// the current catalog; the caller sends the starter it fetched from
// public/templates so the server never reads the filesystem here.
export async function POST(req: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { lessonId, starter } = body

  if (typeof lessonId !== 'number' || typeof starter !== 'string') {
    return NextResponse.json({ error: 'lessonId and starter are required' }, { status: 400 })
  }

  const lesson = getLessonForProject(lessonId, CURRENT_LESSON_VERSION)
  if (!lesson) {
    return NextResponse.json({ error: 'Unknown lesson' }, { status: 404 })
  }

  if (!(await isAdmin(user.id)) && !(await isTeacher(user.id))) {
    const enabledLessonIds = await getEnabledLessonIdsForUser(user.id)
    if (!enabledLessonIds.has(lessonId)) {
      return NextResponse.json(
        { error: 'This lesson is not available for your class right now' },
        { status: 403 }
      )
    }
  }

  const files: Record<string, string> = { [lesson.starterFile]: starter }
  // Extra seeded files (e.g. bugzap.py). Only names the lesson declares are kept.
  for (const name of Object.keys(lesson.extraFiles ?? {})) {
    if (typeof body.extraFiles?.[name] === 'string') files[name] = body.extraFiles[name]
  }

  const insertData: typeof projectsTable.$inferInsert = {
    userId: user.id,
    title: body.title || lesson.title,
    isPublic: false,
    files,
    lessonId,
    lessonVersion: CURRENT_LESSON_VERSION,
  }

  try {
    const [project] = await db.insert(projectsTable).values(insertData).returning(projectColumns)
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    console.error('POST /api/projects error:', err)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

// PATCH /api/projects — update title or is_public for a project
export async function PATCH(req: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, title, is_public, files, board } = body

  if (!id) {
    return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
  }

  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Partial<typeof projectsTable.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }
  if (title !== undefined) updates.title = title
  if (is_public !== undefined) updates.isPublic = is_public
  if (files !== undefined) updates.files = files as ProjectFiles
  if (board !== undefined) {
    const saved = SavedBoard.safeParse(board)
    if (!saved.success) return NextResponse.json({ error: 'Invalid board' }, { status: 400 })
    updates.board = saved.data
  }

  // Ownership enforced by filtering on both id and user_id in the UPDATE
  // itself, so a mismatch updates zero rows rather than someone else's.
  try {
    const [project] = await db
      .update(projectsTable)
      .set(updates)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id)))
      .returning(projectColumns)

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(project)
  } catch (err) {
    console.error('PATCH /api/projects failed:', err)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

// DELETE /api/projects — delete a project
export async function DELETE(req: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
  }

  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    // Ownership is established BEFORE anything is deleted. The previous
    // implementation cleared messages and prompts by project_id alone and only
    // scoped the projects DELETE, so passing someone else's project id wiped
    // their chat history and prompt log while the project itself survived.
    const [owned] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id)))
      .limit(1)

    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // messages cascades with its project, but prompts.project_id is NO ACTION
    // (lib/db/schema.ts keeps the prompt log deliberately), so the child rows
    // are still cleared explicitly before the parent.
    await db.delete(messages).where(eq(messages.projectId, id))
    await db.delete(prompts).where(eq(prompts.projectId, id))
    await db.delete(projectsTable).where(eq(projectsTable.id, id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/projects failed:', err)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
