import type OpenAI from 'openai'
import { apply, summarize, type BoardState } from '@/lib/board/reducer'
import { toOp } from '@/lib/board/tools'

export interface Chunk {
  choices: { delta: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[]
}
export type Llm = (messages: OpenAI.Chat.ChatCompletionMessageParam[]) => Promise<AsyncIterable<Chunk>>

export type TurnEvent =
  | { type: 'caption.delta'; text: string }
  | { type: 'board.op'; op: unknown }
  | { type: 'agent.state'; state: 'thinking' | 'speaking' | 'idle' }
  | { type: 'trace.request'; nodeId: string }
  | { type: 'task.complete'; taskId: string; completedTaskIds: string[] }
  | { type: 'turn.end' }

const MAX_RETRIES = 2

// One tutor turn. Text deltas become captions; each completed tool call is
// validated by the reducer. A rejected call goes back to the model as its tool
// result so it can fix itself, at most MAX_RETRIES times.
export async function runTurn(opts: {
  llm: Llm
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  board: BoardState
  emit: (e: TurnEvent) => void
  // Judges and records a task_complete call. Returns the new done list, or
  // throws with the reason it was refused (which goes back to the model).
  onTaskComplete?: (args: { taskId: string; reason: string }) => Promise<string[]>
}): Promise<{ board: BoardState; text: string }> {
  const { llm, emit } = opts
  let board = opts.board
  const messages = [...opts.messages]
  let spoken = ''
  emit({ type: 'agent.state', state: 'thinking' })

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const calls: { id: string; name: string; args: string }[] = []
    let text = ''
    for await (const chunk of await llm(messages)) {
      const d = chunk.choices[0]?.delta
      if (d?.content) {
        if (!text && !spoken) emit({ type: 'agent.state', state: 'speaking' })
        text += d.content
        emit({ type: 'caption.delta', text: d.content })
      }
      for (const t of d?.tool_calls ?? []) {
        const c = (calls[t.index] ??= { id: '', name: '', args: '' })
        c.id ||= t.id ?? ''
        c.name ||= t.function?.name ?? ''
        c.args += t.function?.arguments ?? ''
      }
    }
    spoken += text

    const results: OpenAI.Chat.ChatCompletionToolMessageParam[] = []
    let failed = false
    for (const c of calls.filter(Boolean)) {
      let content: string
      try {
        const args = JSON.parse(c.args || '{}')
        if (c.name === 'request_trace') {
          // The browser owns the interpreter; it runs the trace after this turn and reports back.
          const n = board.nodes[args.nodeId]
          if (n?.type !== 'code' || n.language !== 'python') throw new Error(`${args.nodeId} is not a Python code node`)
          emit({ type: 'trace.request', nodeId: n.id })
          content = 'ok: the trace node will appear after this turn. Do not add one yourself.'
        } else if (c.name === 'task_complete') {
          if (!opts.onTaskComplete) throw new Error('no task can be completed now')
          const ids = await opts.onTaskComplete({ taskId: String(args.taskId), reason: String(args.reason ?? '') })
          emit({ type: 'task.complete', taskId: String(args.taskId), completedTaskIds: ids })
          content = 'ok: recorded. The student\'s screen opens the next task by itself. Do not announce it.'
        } else {
          const op = toOp(c.name, args)
          board = apply(board, op, 'tutor')
          emit({ type: 'board.op', op })
          content = `ok\n${summarize(board)}`
        }
      } catch (e) {
        failed = true
        content = `error: ${e instanceof Error ? e.message : String(e)}\nBoard now:\n${summarize(board)}`
      }
      results.push({ role: 'tool', tool_call_id: c.id, content })
    }
    if (!failed) break

    messages.push(
      {
        role: 'assistant',
        content: text || null,
        tool_calls: calls.filter(Boolean).map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.args } })),
      },
      ...results,
    )
  }

  emit({ type: 'agent.state', state: 'idle' })
  emit({ type: 'turn.end' })
  return { board, text: spoken }
}
