import { BoardNode, BoardOp, CLIENT_ONLY_TYPES, STUDENT_STEP_FIELDS } from './schema'

export interface BoardState {
  pages: { id: string; title: string; nodeIds: string[] }[]
  activePageId: string | null
  nodes: Record<string, BoardNode>
  focusId: string | null
}

export const emptyBoard = (): BoardState => ({
  pages: [],
  activePageId: null,
  nodes: {},
  focusId: null,
})

// Pure. Throws Error with a readable message on a bad op so the tutor loop can
// hand it back to the model as a tool result.
export function apply(
  state: BoardState,
  raw: unknown,
  actor: 'tutor' | 'client' = 'client'
): BoardState {
  const parsed = BoardOp.safeParse(raw)
  if (!parsed.success)
    throw new Error(`Invalid op: ${parsed.error.issues[0]?.message ?? 'bad shape'}`)
  const op = parsed.data

  switch (op.op) {
    case 'new_page': {
      if (state.pages.some((p) => p.id === op.pageId))
        throw new Error(`Page ${op.pageId} already exists`)
      return {
        ...state,
        pages: [...state.pages, { id: op.pageId, title: op.title, nodeIds: [] }],
        activePageId: op.pageId,
      }
    }
    case 'add': {
      const { node } = op
      if (actor === 'tutor' && (CLIENT_ONLY_TYPES as readonly string[]).includes(node.type)) {
        throw new Error(`The tutor cannot create ${node.type} nodes`)
      }
      if (state.nodes[node.id]) throw new Error(`Node ${node.id} already exists`)
      if (!state.pages.some((p) => p.id === op.pageId)) throw new Error(`Unknown page ${op.pageId}`)
      if (node.parentId && !state.nodes[node.parentId])
        throw new Error(`Unknown parent ${node.parentId}`)
      return {
        ...state,
        nodes: { ...state.nodes, [node.id]: node },
        pages: state.pages.map((p) =>
          p.id === op.pageId ? { ...p, nodeIds: [...p.nodeIds, node.id] } : p
        ),
      }
    }
    case 'update': {
      const old = state.nodes[op.id]
      if (!old) throw new Error(`Unknown node ${op.id}`)
      // id, type and createdBy are identity; a patch may not rewrite them.
      const { id: _id, type: _type, createdBy: _by, ...patch } = op.patch
      if (actor === 'tutor' && STUDENT_STEP_FIELDS.some((f) => f in patch)) {
        throw new Error(`The tutor cannot change ${STUDENT_STEP_FIELDS.join(', ')}`)
      }
      const next = BoardNode.safeParse({ ...old, ...patch })
      if (!next.success) throw new Error(`Bad patch for ${op.id}: ${next.error.issues[0]?.message}`)
      return { ...state, nodes: { ...state.nodes, [op.id]: next.data } }
    }
    case 'remove': {
      if (!state.nodes[op.id]) throw new Error(`Unknown node ${op.id}`)
      const drop = new Set([op.id])
      // Children and runner output/trace/preview attached to a removed node go too.
      for (let grew = true; grew;) {
        grew = false
        for (const n of Object.values(state.nodes)) {
          const owner = n.parentId ?? ('forNodeId' in n ? n.forNodeId : null)
          if (!drop.has(n.id) && owner && drop.has(owner)) (drop.add(n.id), (grew = true))
        }
      }
      return {
        ...state,
        nodes: Object.fromEntries(Object.entries(state.nodes).filter(([id]) => !drop.has(id))),
        pages: state.pages.map((p) => ({ ...p, nodeIds: p.nodeIds.filter((id) => !drop.has(id)) })),
        focusId: state.focusId && drop.has(state.focusId) ? null : state.focusId,
      }
    }
    case 'focus': {
      if (!state.nodes[op.id]) throw new Error(`Unknown node ${op.id}`)
      return { ...state, focusId: op.id }
    }
  }
}

// What the tutor sees after each tool call, so it never invents ids.
// `focusPageId`: the page the student is on. It is listed in full (a program in
// a code node is shown whole); other pages shrink to one line, so the tutor
// cannot mistake an earlier task's board for the one in front of the student.
export function summarize(state: BoardState, focusPageId?: string): string {
  return state.pages
    .map((p) => {
      if (focusPageId && p.id !== focusPageId)
        return `page ${p.id} "${p.title}" (${p.nodeIds.length} nodes, not on screen)`
      const rows = p.nodeIds.map((id) => {
        const n = state.nodes[id]
        const text =
          'text' in n
            ? n.text
            : 'markdown' in n
              ? n.markdown
              : 'source' in n
                ? n.source
                : 'prompt' in n
                  ? n.prompt
                  : ''
        const cap = focusPageId && n.type === 'code' ? 400 : 40
        return `  ${id} [${n.type}] ${text.slice(0, cap).replace(/\n/g, focusPageId ? ' ⏎ ' : ' ')}`
      })
      return `page ${p.id}${p.id === state.activePageId ? ' (active)' : ''} "${p.title}"\n${rows.join('\n')}`
    })
    .join('\n')
}

// For useReducer in the board clients.
export type BoardAction = { op: unknown; actor: 'tutor' | 'client' } | { reset: BoardState }
export const boardReducer = (s: BoardState, a: BoardAction): BoardState =>
  'reset' in a ? a.reset : apply(s, a.op, a.actor)
