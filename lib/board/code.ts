import { BoardNode } from './schema'
import type { BoardState } from './reducer'
import { z } from 'zod'

// The student's program on the board. A project opened from an old editor session
// is seeded as node `main`; otherwise it is the newest editable Python node.
export const MAIN_ID = 'main'

export function codeNodeId(board: BoardState): string | null {
  const isCode = (id: string) => {
    const n = board.nodes[id]
    return n?.type === 'code' && n.editable && n.language === 'python'
  }
  if (isCode(MAIN_ID)) return MAIN_ID
  // Page order, not Object.keys: jsonb storage reorders object keys, so key order is not creation order.
  return (
    board.pages
      .flatMap((p) => p.nodeIds)
      .filter(isCode)
      .at(-1) ?? null
  )
}

export function boardCode(board: BoardState): string | null {
  const id = codeNodeId(board)
  const n = id ? board.nodes[id] : null
  return n?.type === 'code' ? n.source : null
}

const isEditablePython = (board: BoardState, id: string) => {
  const n = board.nodes[id]
  return n?.type === 'code' && n.editable && n.language === 'python'
}

// The code node a single page owns. One board page belongs to one lesson task
// (lib/board/tasks.ts), so this — not boardCode — is the source a task's checks
// must read. boardCode spans the whole board and would hand an open task the
// code of a later one the moment a new page appears.
export function pageCodeNodeId(board: BoardState, pageId: string | null): string | null {
  const page = board.pages.find((p) => p.id === pageId)
  return page?.nodeIds.filter((id) => isEditablePython(board, id)).at(-1) ?? null
}

export function pageCode(board: BoardState, pageId: string | null): string | null {
  const id = pageCodeNodeId(board, pageId)
  const n = id ? board.nodes[id] : null
  return n?.type === 'code' ? n.source : null
}

// The file a code node edits. Nodes carry `file` only for multi-file tasks
// (bugzap.py); everything else is the lesson's entry file.
export function fileOf(node: { file?: string }, entry: string): string {
  return node.file ?? entry
}

// Every file the board currently defines, newest node per file winning. Page
// order, not Object.keys, for the same jsonb reason as codeNodeId.
export function boardFiles(board: BoardState, entry: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of board.pages.flatMap((p) => p.nodeIds)) {
    const n = board.nodes[id]
    if (n?.type === 'code' && n.editable) out[fileOf(n, entry)] = n.source
  }
  return out
}

// The project's files with the board's program written back, so share, fork and
// explore (which read `files`) see what the student wrote.
export function withBoardCode(
  files: Record<string, string>,
  entry: string,
  board: BoardState
): Record<string, string> {
  const written = boardFiles(board, entry)
  return Object.keys(written).length === 0 ? files : { ...files, ...written }
}

// A board for work done before the board existed: one page holding the student's code.
export function boardFromFiles(source: string): BoardState {
  return {
    pages: [{ id: 'p_main', title: 'My code', nodeIds: [MAIN_ID] }],
    activePageId: 'p_main',
    focusId: null,
    nodes: {
      [MAIN_ID]: {
        id: MAIN_ID,
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source,
        editable: true,
        highlightLines: [],
      },
    },
  }
}

// What a client may save: the same shape the server persists.
export const SavedBoard = z.object({
  pages: z
    .array(z.object({ id: z.string(), title: z.string().max(40), nodeIds: z.array(z.string()) }))
    .max(20),
  activePageId: z.string().nullable(),
  nodes: z.record(z.string(), BoardNode),
  focusId: z.string().nullable(),
})
