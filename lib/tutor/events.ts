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
  z.object({
    type: z.literal('trace_result'),
    nodeId: NodeId,
    source: z.string().max(4000),
    steps: z.array(TraceStep).max(200),
  }),
  // The student passed a task's checks; their screen has already opened the
  // next task's page. The tutor is told so it can introduce it.
  z.object({
    type: z.literal('task_advanced'),
    done: z.string().max(64),
    next: z.string().max(64).nullable(),
    pageId: z.string().max(64).nullable(),
  }),
  // A wrong pick on a scripted step, or a stage program that missed its goal. The payload
  // carries what the student saw, so it does not wait on the debounced board save.
  z.object({
    type: z.literal('step_answer'),
    nodeId: NodeId,
    prompt: z.string().max(400),
    picked: z.string().max(160),
    attempts: z.number().int().min(0).max(20),
  }),
  z.object({
    type: z.literal('stage_result'),
    nodeId: NodeId,
    prompt: z.string().max(400),
    program: z.array(z.string().max(40)).max(8),
    attempts: z.number().int().min(0).max(20),
  }),
  // Bolt, the helper AI of director lessons, just wrote this block from the student's
  // request. Sparky gets one turn to ask about it; the route gives that turn no tools.
  z.object({ type: z.literal('helper_result'), nodeId: NodeId }),
])
export type ClientEvent = z.infer<typeof ClientEvent>

// What the tutor is told for this event, and the board after the client's own
// side effects (a run writes the output node) are applied. Throws on a bad event.
export function applyClientEvent(
  board: BoardState,
  ev: ClientEvent
): { board: BoardState; content: string; saveText?: string } {
  switch (ev.type) {
    case 'session_start':
      return {
        board,
        content: `<student_event type="session_start"/>\n${board.pages.length ? 'The student just opened this board. Say hello in one short sentence, then tell them the ONE thing to do next (see TASK STATE: which button to tap). Say "welcome back" only if they have already answered steps or finished a task. Do not guess what will happen next.' : 'The board is empty. Greet the student in one short sentence and draw the first page with tools.'}`,
      }
    case 'student_message':
      return { board, content: ev.text, saveText: ev.text }
    case 'code_run_result': {
      const next = runOps(board, ev.nodeId, ev).reduce((b, op) => apply(b, op, 'client'), board)
      // Which program ran: a task page can hold two, and the tutor must answer about the right one.
      const page = board.pages.find((p) => p.nodeIds.includes(ev.nodeId))
      const codeIds = (page?.nodeIds ?? []).filter((i) => {
        const n = board.nodes[i]
        return n?.type === 'code' && n.editable
      })
      const node = board.nodes[ev.nodeId]
      const which = {
        file: node?.type === 'code' ? (node.file ?? null) : null,
        program: `${codeIds.indexOf(ev.nodeId) + 1} of ${codeIds.length} on this page`,
      }
      // The tutor gets the tail of stderr (where Python puts the real error), not the whole traceback.
      const payload = {
        nodeId: ev.nodeId,
        ...which,
        ok: ev.ok,
        stdout: ev.stdout.slice(0, 500),
        error: ev.stderr.trim().split('\n').slice(-3).join('\n'),
      }
      return {
        board: next,
        content: `<student_event type="code_run">${JSON.stringify(payload)}</student_event>`,
      }
    }
    case 'task_advanced': {
      const payload = { finished: ev.done, nowOpen: ev.next, pageId: ev.pageId }
      const note = ev.next
        ? 'Their next page is already open and holds their code so far. Say one short, specific sentence about what they just got working, then start that task with a small question. Do not repeat the task name back as a heading.'
        : 'That was the last task. Congratulate them warmly in one sentence.'
      return {
        board,
        content: `<student_event type="task_advanced">${JSON.stringify(payload)}</student_event>\n${note}`,
      }
    }
    case 'step_answer':
    case 'stage_result': {
      const { type, ...payload } = ev
      const note =
        ev.type === 'step_answer'
          ? 'The student picked a wrong answer on the scripted question they are on (see TASK STATE). Answer in one or two short, kind sentences: point at the idea behind the question. Do not say the right answer unless attempts is 2 or more. Do not use any tools.'
          : 'The student ran a program on the scripted scene they are on (see TASK STATE) and it did not reach the goal. Say in one or two short, kind sentences what their program did and one thing to look at. Do not give the full solution unless attempts is 3 or more. Do not use any tools.'
      return {
        board,
        content: `<student_event type="${type}">${JSON.stringify(payload)}</student_event>\n${note}`,
      }
    }
    case 'helper_result': {
      const n = board.nodes[ev.nodeId]
      if (n?.type !== 'helper') throw new Error(`Unknown Bolt block ${ev.nodeId}`)
      const payload = { asked: n.request, boltWrote: n.source }
      return {
        board,
        content: `<helper_event>${JSON.stringify(payload)}</helper_event>\nBolt just wrote this for the student. Ask them one short question about it, for example whether it does what they asked. Do not write, fix or improve the code.`,
      }
    }
    case 'trace_result': {
      const next = traceOps(board, ev.nodeId, ev.source, ev.steps).reduce(
        (b, op) => apply(b, op, 'client'),
        board
      )
      const last = ev.steps.at(-1)
      const payload = {
        nodeId: ev.nodeId,
        traceNodeId: `trace_${ev.nodeId}`,
        steps: ev.steps.length,
        lastVars: last?.vars.map((v) => `${v.name}=${v.repr}`) ?? [],
      }
      const note = ev.steps.length
        ? 'The trace is on the board at step 0. Say one short sentence to start it; use board_update with cursor to move it.'
        : 'The trace produced no steps. Say so kindly.'
      return {
        board: next,
        content: `<student_event type="trace_ready">${JSON.stringify(payload)}</student_event>\n${note}`,
      }
    }
  }
}
