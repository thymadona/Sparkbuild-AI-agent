import { randomUUID } from 'crypto'
import { deepseek, MODEL } from '@/lib/deepseek'
import { blockOf, pageCodeNodeId } from '@/lib/board/code'
import { apply, type BoardState } from '@/lib/board/reducer'
import { codeLines, MAX_HELPER_LINES, type BoardOp } from '@/lib/board/schema'
import { runTurn, type Llm } from '@/lib/tutor/turn'
import { BOLT_FAILED, BOLT_PROMPT, BOLT_TOO_BIG, BOLT_TOOL, boltRequest } from './prompt'

export const boltLlm: Llm = (msgs) =>
  deepseek.chat.completions.create({
    model: MODEL,
    stream: true,
    tools: [BOLT_TOOL],
    tool_choice: { type: 'function', function: { name: 'write_code' } },
    messages: msgs,
    thinking: { type: 'disabled' },
  } as never) as unknown as ReturnType<Llm>

// Models often wrap code in a ``` fence; the block shows only the code.
const unfence = (code: string) =>
  code
    .replace(/^\s*```[a-z]*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trimEnd()

// One Bolt request: the model sees BOLT_PROMPT, the request and the student's code on
// `pageId` (the block their editor shows), nothing else. Its write_code call becomes a
// helper block; over MAX_HELPER_LINES goes back to it as an error, and runTurn re-asks
// at most twice. No persistence: the route owns that.
export async function runBolt(opts: {
  board: BoardState
  pageId: string
  request: string
  llm?: Llm
}): Promise<{ board: BoardState; op: BoardOp | null; caption: string; content: string }> {
  const { board, pageId, request } = opts
  const codeNode = board.nodes[pageCodeNodeId(board, pageId) ?? '']
  const studentCode =
    codeNode?.type === 'code' ? blockOf(codeNode.source, codeNode.anchor).block : ''
  const content = boltRequest(request, studentCode)

  let added: BoardOp | null = null
  let caption = ''
  let tooBig = false
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

  const result = await runTurn({
    llm: opts.llm ?? boltLlm,
    board,
    act,
    emit: () => {},
    messages: [
      { role: 'system', content: BOLT_PROMPT },
      { role: 'user', content },
    ],
  })
  const op = added as BoardOp | null
  return {
    board: result.board,
    op,
    caption: op ? caption || 'Here it is.' : tooBig ? BOLT_TOO_BIG : BOLT_FAILED,
    content,
  }
}
