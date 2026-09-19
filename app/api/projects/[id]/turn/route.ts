import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { messages, projects, prompts } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { deepseek, MODEL } from '@/lib/gemini'
import { checkRateLimit } from '@/lib/ratelimit'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { getLessonForProject } from '@/lib/lessons'
import { entryFileFor } from '@/lib/starter-file'
import { withBoardCode } from '@/lib/board/code'
import { emptyBoard, summarize, type BoardState } from '@/lib/board/reducer'
import { TOOLS } from '@/lib/board/tools'
import { ClientEvent, applyClientEvent } from '@/lib/tutor/events'
import { lessonLayer, TUTOR_PROMPT } from '@/lib/tutor/prompt'
import { runTurn, type Llm, type TurnEvent } from '@/lib/tutor/turn'

export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const [admin, teacher] = await Promise.all([isAdmin(user.id), isTeacher(user.id)])
  if (!admin && !teacher) {
    const { allowed, hoursUntilReset } = await checkRateLimit(user.id)
    if (!allowed) {
      return NextResponse.json({ error: `Hourly limit reached. Resets in ${hoursUntilReset} hour${hoursUntilReset === 1 ? '' : 's'}.` }, { status: 429 })
    }
  }

  const parsed = ClientEvent.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event' }, { status: 400 })

  const [project] = await db
    
    .select({ board: projects.board, files: projects.files, lessonId: projects.lessonId, lessonVersion: projects.lessonVersion })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const history = (
    await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.projectId, id))
      .orderBy(desc(messages.createdAt))
      .limit(10)
  ).reverse()

  let board = (project.board as BoardState | null) ?? emptyBoard()
  let event: ReturnType<typeof applyClientEvent>
  try {
    event = applyClientEvent(board, parsed.data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid event' }, { status: 400 })
  }
  board = event.board
  const lesson = project.lessonId != null ? getLessonForProject(project.lessonId, project.lessonVersion) : null
  const files = (project.files ?? {}) as Record<string, string>
  const system = `${TUTOR_PROMPT}\n\n${lessonLayer(lesson, summarize(board))}`
  const userContent = event.content

  const llm: Llm = (msgs) =>
    deepseek.chat.completions.create({
      model: MODEL,
      stream: true,
      tools: TOOLS,
      messages: msgs,
      thinking: { type: 'disabled' }, // DeepSeek extension; captions must start fast
    } as never) as unknown as ReturnType<Llm>

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: TurnEvent | { type: 'error'; message: string }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      try {
        const result = await runTurn({
          llm,
          board,
          emit: send,
          messages: [
            { role: 'system', content: system },
            ...history.map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content })),
            { role: 'user', content: userContent },
          ],
        })
        // Ownership predicate repeated so the write can't outlive the check above.
        await db
          .update(projects)
          .set({ board: result.board, files: withBoardCode(files, entryFileFor(lesson, files), result.board), updatedAt: new Date().toISOString() })
          .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
        const rows = [
          ...(event.saveText ? [{ projectId: id, userId: user.id, role: 'user' as const, content: event.saveText }] : []),
          ...(result.text ? [{ projectId: id, userId: user.id, role: 'assistant' as const, content: result.text }] : []),
        ]
        if (rows.length) await db.insert(messages).values(rows)
        await db.insert(prompts).values({ userId: user.id, projectId: id, content: userContent, context: { tutor: 'board', system } }).catch((e) => console.error('prompt log failed:', e))
      } catch (err) {
        console.error('tutor turn error:', err)
        send({ type: 'error', message: 'Spark had a problem. Try again.' })
      }
      controller.close()
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
}
