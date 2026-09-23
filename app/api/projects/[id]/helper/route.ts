import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { messages, projects, prompts } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { deepseek, MODEL } from '@/lib/deepseek'
import { checkRateLimit } from '@/lib/ratelimit'
import { isAdmin, isTeacher } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { getLessonForProject } from '@/lib/lessons'
import { blockOf, pageCodeNodeId } from '@/lib/board/code'
import { apply, emptyBoard, type BoardState } from '@/lib/board/reducer'
import { codeLines, MAX_HELPER_LINES, type BoardOp } from '@/lib/board/schema'
import { runTurn, type Llm } from '@/lib/tutor/turn'
import { BOLT_FAILED, BOLT_PROMPT, BOLT_TOO_BIG, BOLT_TOOL, boltRequest } from '@/lib/helper/prompt'

export const runtime = 'nodejs'

// Task pages are t_<taskId> (ids have hyphens), so pageId is not a NodeId; it must be on the board.
const Body = z.object({
  request: z.string().trim().min(1).max(500),
  pageId: z.string().min(1).max(80),
})

// Models often wrap code in a ``` fence; the block shows only the code.
const unfence = (code: string) =>
  code
    .replace(/^\s*```[a-z]*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trimEnd()

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
  // What the student's editor shows on that page: their task's block, not the whole file.
  const codeNode = board.nodes[pageCodeNodeId(board, pageId) ?? '']
  const studentCode =
    codeNode?.type === 'code' ? blockOf(codeNode.source, codeNode.anchor).block : ''

  let added: BoardOp | null = null
  let caption = ''
  let tooBig = false
  // Bolt's one tool call becomes its block. A rule it breaks goes back to it as an error,
  // and runTurn re-asks, at most twice.
  const act = (name: string, args: Record<string, unknown>, b: BoardState) => {
    if (added) return { board: b, op: null } // one block per request; extra calls are ignored
    if (name !== 'write_code' || typeof args.code !== 'string')
      throw new Error('Call write_code with the code and a caption.')
    const source = unfence(args.code)
    const lines = codeLines(source)
    tooBig = lines > MAX_HELPER_LINES
    if (tooBig)
      throw new Error(
        `Your code has ${lines} lines. The limit is ${MAX_HELPER_LINES}. Build only what was asked, in fewer lines.`
      )
    const op: BoardOp = {
      op: 'add',
      pageId,
      node: {
        id: `bolt_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        parentId: null,
        createdBy: 'system',
        type: 'helper',
        request,
        source,
      },
    }
    const next = apply(b, op, 'bolt')
    added = op
    caption = String(args.caption ?? '')
      .trim()
      .slice(0, 200)
    return { board: next, op }
  }

  const llm: Llm = (msgs) =>
    deepseek.chat.completions.create({
      model: MODEL,
      stream: true,
      tools: [BOLT_TOOL],
      tool_choice: { type: 'function', function: { name: 'write_code' } },
      messages: msgs,
      thinking: { type: 'disabled' },
    } as never) as unknown as ReturnType<Llm>

  const userContent = boltRequest(request, studentCode)
  try {
    const result = await runTurn({
      llm,
      board,
      act,
      emit: () => {},
      messages: [
        { role: 'system', content: BOLT_PROMPT },
        { role: 'user', content: userContent },
      ],
    })
    const op = added as BoardOp | null
    if (!op) caption = tooBig ? BOLT_TOO_BIG : BOLT_FAILED
    const source = op?.op === 'add' && op.node.type === 'helper' ? op.node.source : null

    if (op)
      // Ownership predicate repeated so the write can't outlive the check above.
      await db
        .update(projects)
        .set({ board: result.board, updatedAt: new Date().toISOString() })
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
        content: userContent,
        context: { tutor: 'bolt', system: BOLT_PROMPT },
      })
      .catch((e) => console.error('prompt log failed:', e))

    return NextResponse.json({ op, caption: caption || 'Here it is.' })
  } catch (err) {
    console.error('bolt error:', err)
    return NextResponse.json({ error: 'Bolt had a problem. Try again.' }, { status: 500 })
  }
}
