import { z } from 'zod'
import { apply, type BoardState } from '@/lib/board/reducer'
import { runOps, traceOps } from '@/lib/board/run'
import { NodeId, TraceStep } from '@/lib/board/schema'

export const ClientEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session_start') }),
  z.object({ type: z.literal('student_message'), text: z.string().trim().min(1).max(1000) }),
  z.object({
    type: z.literal('code_run_result'),
    nodeId: NodeId,
    source: z.string().max(4000),
    ok: z.boolean(),
    stdout: z.string().max(20000),
    stderr: z.string().max(20000),
  }),
  z.object({ type: z.literal('trace_result'), nodeId: NodeId, source: z.string().max(4000), steps: z.array(TraceStep).max(200) }),
])
export type ClientEvent = z.infer<typeof ClientEvent>

// What the tutor is told for this event, and the board after the client's own
// side effects (a run writes the output node) are applied. Throws on a bad event.
export function applyClientEvent(board: BoardState, ev: ClientEvent): { board: BoardState; content: string; saveText?: string } {
  switch (ev.type) {
    case 'session_start':
      return {
        board,
        content: `<student_event type="session_start"/>\n${board.pages.length ? 'Welcome the student back and continue from the board.' : 'The board is empty. Greet the student in one short sentence and draw the first page with tools.'}`,
      }
    case 'student_message':
      return { board, content: ev.text, saveText: ev.text }
    case 'code_run_result': {
      const next = runOps(board, ev.nodeId, ev).reduce((b, op) => apply(b, op, 'client'), board)
      // The tutor gets the tail of stderr (where Python puts the real error), not the whole traceback.
      const payload = { nodeId: ev.nodeId, ok: ev.ok, stdout: ev.stdout.slice(0, 500), error: ev.stderr.trim().split('\n').slice(-3).join('\n') }
      return { board: next, content: `<student_event type="code_run">${JSON.stringify(payload)}</student_event>` }
    }
    case 'trace_result': {
      const next = traceOps(board, ev.nodeId, ev.source, ev.steps).reduce((b, op) => apply(b, op, 'client'), board)
      const last = ev.steps.at(-1)
      const payload = { nodeId: ev.nodeId, traceNodeId: `trace_${ev.nodeId}`, steps: ev.steps.length, lastVars: last?.vars.map((v) => `${v.name}=${v.repr}`) ?? [] }
      const note = ev.steps.length ? 'The trace is on the board at step 0. Say one short sentence to start it; use board_update with cursor to move it.' : 'The trace produced no steps. Say so kindly.'
      return { board: next, content: `<student_event type="trace_ready">${JSON.stringify(payload)}</student_event>\n${note}` }
    }
  }
}
