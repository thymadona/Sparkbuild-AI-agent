import { z } from 'zod'
import type OpenAI from 'openai'
import { BoardNode, CLIENT_ONLY_TYPES, NodeId } from './schema'

// The tutor may only create these; CLIENT_ONLY_TYPES belong to the client.
const TutorNode = BoardNode.options.filter((o) => !(CLIENT_ONLY_TYPES as readonly string[]).includes(o.shape.type.value))

// createdBy/parentId are filled in by the server, so the model never sees them.
const tutorNodeSchema = z.union(
  (TutorNode as unknown as z.ZodObject[]).map((o) => o.omit({ createdBy: true, parentId: true }).extend({ parentId: NodeId.nullable().default(null) })) as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]],
)

const fn = (name: string, description: string, params: z.ZodType) => ({
  type: 'function' as const,
  function: { name, description, parameters: z.toJSONSchema(params) as Record<string, unknown> },
})

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  fn('board_add', 'Add one node to a page of the board.', z.object({ pageId: z.string(), node: tutorNodeSchema })),
  fn('board_update', 'Change fields of an existing node, e.g. source.', z.object({ id: NodeId, patch: z.record(z.string(), z.unknown()) })),
  fn('board_remove', 'Remove a node the lesson is done with.', z.object({ id: NodeId })),
  fn('board_focus', 'Draw the student\'s eye to a node.', z.object({ id: NodeId })),
  fn('request_trace', 'Ask the student\'s browser to run a Python code node line by line and put a trace node on the board. Use it to show how variables change.', z.object({ nodeId: NodeId })),
  fn('board_new_page', 'Start a new page for a new idea.', z.object({ pageId: z.string(), title: z.string().max(40) })),
  fn('task_complete', 'Record that the student finished the OPEN lesson task. Call it only when the evidence shows every requirement is met. The server may refuse.', z.object({ taskId: z.string(), reason: z.string().max(200) })),
]

// In a lesson, pages are task pages: the client opens one per task as the
// student completes the previous one (lib/board/tasks.ts). Letting the tutor
// call board_new_page there would create a page with no task bound to it, so
// the tool is withheld. Free-form boards keep it.
// task_complete exists only while a task is open and its editor is showing.
export const toolsFor = (inLesson: boolean, canComplete = false): OpenAI.Chat.ChatCompletionTool[] =>
  inLesson ? TOOLS.filter((t) => t.function.name !== 'board_new_page' && (canComplete || t.function.name !== 'task_complete')) : TOOLS.filter((t) => t.function.name !== 'task_complete')

// Tool call -> BoardOp (validated by the reducer).
export function toOp(name: string, args: Record<string, unknown>): unknown {
  const op = name.replace('board_', '')
  if (op === 'add') {
    const node = args.node as Record<string, unknown> | undefined
    return { op, pageId: args.pageId, node: { parentId: null, ...node, createdBy: 'tutor' } }
  }
  return { op, ...args }
}
