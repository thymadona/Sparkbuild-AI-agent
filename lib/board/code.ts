import { BoardNode } from './schema'
import type { BoardState } from './reducer'
import { z } from 'zod'
import { TASK_ID_ALIASES } from '@/lib/lessons'

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
  const all = board.pages.flatMap((p) => p.nodeIds).filter(isCode)
  // A task can hold a second, separate program (lib/lessons.ts `then`); it must
  // never be mistaken for the student's main program and carried to the next task.
  return (
    all.filter((id) => !(board.nodes[id] as { file?: string }).file).at(-1) ?? all.at(-1) ?? null
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
  const all = page?.nodeIds.filter((id) => isEditablePython(board, id)) ?? []
  return (
    all.filter((id) => !(board.nodes[id] as { file?: string }).file).at(-1) ?? all.at(-1) ?? null
  )
}

export function pageCode(board: BoardState, pageId: string | null): string | null {
  const id = pageCodeNodeId(board, pageId)
  const n = id ? board.nodes[id] : null
  return n?.type === 'code' ? n.source : null
}

// The part of a file one task works in: the lines under its `# TASK: <id>`
// comment, up to the next `# TASK:` comment. The node keeps the whole program
// (it is what runs, is checked and is carried forward); the editor shows only
// this block, so a child sees the few lines to change, not the whole starter.
// `compose` puts an edited block back. Without an anchor, or when the comment is
// gone, it is the whole file: a broken anchor must never hide the student's code.
export interface Block {
  block: string
  // Lines above the block, to turn a whole-file line number into a block line number.
  offset: number
  compose: (block: string) => string
}

// A node's anchor is baked in at creation time from the task's commentAnchor
// (app/board/LiveBoard.tsx), so a renamed id leaves already-created nodes
// pointing at the old anchor text. Try the id(s) it was renamed from before
// falling open to the whole file. ponytail: one hop, matching TASK_ID_ALIASES.
function anchorCandidates(anchor: string): string[] {
  const id = anchor.match(/^TASK: (.+)$/)?.[1]
  if (!id) return [anchor]
  const oldIds = Object.entries(TASK_ID_ALIASES)
    .filter(([, newId]) => newId === id)
    .map(([oldId]) => `TASK: ${oldId}`)
  return [anchor, ...oldIds]
}

export function blockOf(source: string, anchor?: string): Block {
  const lines = source.split('\n')
  const candidates = anchor ? anchorCandidates(anchor) : []
  const at = candidates.length
    ? lines.findIndex((l) => candidates.some((c) => l.trim() === `# ${c}`))
    : -1
  if (at < 0) return { block: source, offset: 0, compose: (v) => v }
  const next = lines.findIndex((l, i) => i > at && /^#\s*TASK:/.test(l))
  const end = next < 0 ? lines.length : next
  const head = lines.slice(0, at + 1)
  const rest = lines.slice(end)
  const empty = end === at + 1
  return {
    block: lines.slice(at + 1, end).join('\n'),
    offset: at + 1,
    // An untouched empty block must stay empty, or every Run would add a blank line.
    compose: (v) => [...head, ...(v === '' && empty ? [] : v.split('\n')), ...rest].join('\n'),
  }
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
