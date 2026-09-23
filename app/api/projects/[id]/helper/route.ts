import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { messages, projects, prompts } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { checkRateLimit } from '@/lib/ratelimit'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { getLessonForProject } from '@/lib/lessons'
import { emptyBoard, type BoardState } from '@/lib/board/reducer'
import { runBolt } from '@/lib/helper/bolt'
import { BOLT_PROMPT } from '@/lib/helper/prompt'

export const runtime = 'nodejs'

// Task pages are t_<taskId> (ids have hyphens), so pageId is not a NodeId; it must be on the board.
const Body = z.object({
  request: z.string().trim().min(1).max(500),
  pageId: z.string().min(1).max(80),
})

// Bolt, the helper AI of director lessons: writes a small read-only block from the
// student's request. Answers in one JSON reply, not SSE — the 8-line cap can only be
// checked on the whole answer. Never evidence for a task, never completes one.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Same bucket as Sparky's turns.
  const [admin, teacher] = await Promise.all([isAdmin(user.id), isTeacher(user.id)])
  if (!admin && !teacher) {
    const { allowed } = await checkRateLimit(user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Slow down and try again in a moment.' },
        { status: 429 }
      )
    }
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { request, pageId } = parsed.data

  const [project] = await db
    .select({
      board: projects.board,
      lessonId: projects.lessonId,
      lessonVersion: projects.lessonVersion,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const lesson =
    project.lessonId != null ? getLessonForProject(project.lessonId, project.lessonVersion) : null
  if (lesson?.aiPolicy !== 'director')
    return NextResponse.json({ error: 'Bolt is not open in this lesson.' }, { status: 403 })

  const board = (project.board as BoardState | null) ?? emptyBoard()
  if (!board.pages.some((p) => p.id === pageId))
    return NextResponse.json({ error: 'Unknown page' }, { status: 400 })

  try {
    const { board: next, op, caption, content } = await runBolt({ board, pageId, request })
    const source = op?.op === 'add' && op.node.type === 'helper' ? op.node.source : null

    if (op)
      // Ownership predicate repeated so the write can't outlive the check above.
      await db
        .update(projects)
        .set({ board: next, updatedAt: new Date().toISOString() })
        .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    await db.insert(messages).values({
      projectId: id,
      userId: user.id,
      role: 'helper',
      content: `Asked Bolt: ${request}\n${source !== null ? `Bolt wrote:\n${source}` : `Bolt wrote no code: ${caption}`}`,
    })
    await db
      .insert(prompts)
      .values({
        userId: user.id,
        projectId: id,
        content,
        context: { tutor: 'bolt', system: BOLT_PROMPT },
      })
      .catch((e) => console.error('prompt log failed:', e))

    return NextResponse.json({ op, caption })
  } catch (err) {
    console.error('bolt error:', err)
    return NextResponse.json({ error: 'Bolt had a problem. Try again.' }, { status: 500 })
  }
}
