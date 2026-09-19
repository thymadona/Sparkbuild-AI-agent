import type { BoardOp, TraceStep } from './schema'
import type { BoardState } from './reducer'

export interface RunResult {
  source: string
  ok: boolean
  stdout: string
  stderr: string
}

// The ops a finished run writes to the board: the code node's source as it was
// run, and its output node. Shared by the client (instant) and the server (which
// owns the persisted board), so both arrive at the same state.
export function runOps(board: BoardState, nodeId: string, r: RunResult): BoardOp[] {
  const code = board.nodes[nodeId]
  if (code?.type !== 'code') throw new Error(`Unknown code node ${nodeId}`)
  const outId = `out_${nodeId}`
  const output = { stdout: r.stdout.slice(0, 4000), stderr: r.stderr.slice(0, 4000), ok: r.ok }
  const pageId = board.pages.find((p) => p.nodeIds.includes(nodeId))?.id
  return [
    { op: 'update', id: nodeId, patch: { source: r.source.slice(0, 4000) } },
    board.nodes[outId]
      ? { op: 'update', id: outId, patch: output }
      : { op: 'add', pageId: pageId!, node: { id: outId, parentId: null, createdBy: 'system', type: 'output', forNodeId: nodeId, ...output } },
  ]
}

// A finished trace: the code node's source as traced, and its trace node (rewound to step 0).
export function traceOps(board: BoardState, nodeId: string, source: string, steps: TraceStep[]): BoardOp[] {
  if (board.nodes[nodeId]?.type !== 'code') throw new Error(`Unknown code node ${nodeId}`)
  const id = `trace_${nodeId}`
  const pageId = board.pages.find((p) => p.nodeIds.includes(nodeId))?.id
  return [
    { op: 'update', id: nodeId, patch: { source: source.slice(0, 4000) } },
    board.nodes[id]
      ? { op: 'update', id, patch: { steps, cursor: 0 } }
      : { op: 'add', pageId: pageId!, node: { id, parentId: null, createdBy: 'system', type: 'trace', forNodeId: nodeId, steps, cursor: 0 } },
  ]
}
