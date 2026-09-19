import { BoardNode } from './schema'
import type { BoardState } from './reducer'
import { z } from 'zod'

// The student's program on the board. A project opened from an old editor session
// is seeded as node `main`; otherwise it is the newest editable Python node.
export const MAIN_ID = 'main'

export function codeNodeId(board: BoardState): string | null {
  const isCode = (id: string) => { const n = board.nodes[id]; return n?.type === 'code' && n.editable && n.language === 'python' }
  if (isCode(MAIN_ID)) return MAIN_ID
  // Page order, not Object.keys: jsonb storage reorders object keys, so key order is not creation order.
  return board.pages.flatMap((p) => p.nodeIds).filter(isCode).at(-1) ?? null
}

export function boardCode(board: BoardState): string | null {
  const id = codeNodeId(board)
  const n = id ? board.nodes[id] : null
  return n?.type === 'code' ? n.source : null
}

// The project's files with the board's program written back to the entry file, so
// share, fork and explore (which read `files`) see what the student wrote.
export function withBoardCode(files: Record<string, string>, entry: string, board: BoardState): Record<string, string> {
  const code = boardCode(board)
  return code === null ? files : { ...files, [entry]: code }
}

// A board for work done before the board existed: one page holding the student's code.
export function boardFromFiles(source: string): BoardState {
  return {
    pages: [{ id: 'p_main', title: 'My code', nodeIds: [MAIN_ID] }],
    activePageId: 'p_main',
    focusId: null,
    nodes: { [MAIN_ID]: { id: MAIN_ID, parentId: null, createdBy: 'student', type: 'code', language: 'python', source, editable: true, highlightLines: [] } },
  }
}

// What a client may save: the same shape the server persists.
export const SavedBoard = z.object({
  pages: z.array(z.object({ id: z.string(), title: z.string().max(40), nodeIds: z.array(z.string()) })).max(20),
  activePageId: z.string().nullable(),
  nodes: z.record(z.string(), BoardNode),
  focusId: z.string().nullable(),
})
