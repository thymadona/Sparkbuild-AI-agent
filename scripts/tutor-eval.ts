// Does Spark judge tasks the way we expect? Runs canned student situations through
// the real turn loop against DeepSeek and checks whether it called task_complete.
// Not part of CI (it needs the network and costs tokens).
//   bun --env-file=.env run scripts/tutor-eval.ts
import { deepseek, MODEL } from '@/lib/deepseek'
import { LESSONS } from '@/lib/lessons'
import { runTurn, type Llm } from '@/lib/tutor/turn'
import { toolsFor } from '@/lib/board/tools'
import { summarize, type BoardState } from '@/lib/board/reducer'
import { applyClientEvent, type ClientEvent } from '@/lib/tutor/events'
import { lessonLayer, TUTOR_PROMPT } from '@/lib/tutor/prompt'
import { buildTaskNudge } from '@/lib/task-guard'
import { describeEvidence, describeTaskState, hasRun, taskPrograms } from '@/lib/task-evidence'
import { taskCodeNodeId, taskPageId } from '@/lib/board/tasks'

const lesson = LESSONS[0]

interface Scenario { second?: string; name: string; task: string; source: string; event: (nodeId: string, source: string) => ClientEvent; stdout?: string; complete: boolean }
const run = (stdout: string) => (nodeId: string, source: string): ClientEvent => ({ type: 'code_run_result', nodeId, source, ok: true, stdout, stderr: '' })
const say = (text: string) => (): ClientEvent => ({ type: 'student_message', text })

const SCENARIOS: Scenario[] = [
  { name: 'first-words both blocks changed', task: 'first-words', source: 'print("hello Moral")\n', second: 'print("Hi Moral")\nprint("see you soon")\n', event: run('Hi Moral\nsee you soon\n'), complete: true },
  { name: 'first-words line 2 unchanged', task: 'first-words', source: 'print("hello Moral")\n', second: 'print("Hi Moral")\nprint("bye bye")\n', event: run('Hi Moral\nbye bye\n'), complete: false },
  { name: 'name-tag solved', task: 'name-tag', source: 'name = "Ada"\nprint(f"Hi {name}")\n', event: run('Hi Ada\n'), complete: true },
  { name: 'name-tag no f-string', task: 'name-tag', source: 'name = "Ada"\nprint("Hi name")\n', event: run('Hi name\n'), complete: false },
  { name: 'name-tag says done, never ran', task: 'name-tag', source: 'name = "Ada"\nprint(f"Hi {name}")\n', event: say('I am done!'), complete: false },
  { name: 'shout in capitals', task: 'shout', source: 'name = "Ada"\nprint(f"Hi {name}")\nprint(name.upper())\n', event: run('Hi Ada\nADA\n'), complete: true },
  { name: 'shout, still lowercase', task: 'shout', source: 'name = "Ada"\nprint(f"Hi {name}")\n', event: run('Hi Ada\n'), complete: false },
  { name: 'intro-3 same line 3 times', task: 'intro-3', source: 'print("Hi")\nprint("Hi")\nprint("Hi")\n', event: run('Hi\nHi\nHi\n'), complete: false },
  { name: 'intro-3 three different lines', task: 'intro-3', source: 'print("Hi I am Ada")\nprint("I like cats")\nprint("Nice to meet you")\n', event: run('Hi I am Ada\nI like cats\nNice to meet you\n'), complete: true },
]

async function play(s: Scenario) {
  const task = lesson.tasks.find((t) => t.id === s.task)!
  const id = taskCodeNodeId(task)
  const page = taskPageId(task)
  const two = s.second !== undefined
  const code = (i: string, source: string, file?: string) => ({ id: i, parentId: null, createdBy: 'student', type: 'code', language: 'python', source, editable: true, file })
  const board = {
    pages: [{ id: page, title: task.chip, nodeIds: two ? [id, `out_${id}`, `${id}_2`] : [id] }], activePageId: page, focusId: null,
    nodes: { [id]: code(id, s.source), ...(two ? { [`out_${id}`]: { id: `out_${id}`, parentId: null, createdBy: 'system', type: 'output', forNodeId: id, stdout: 'hello Moral\n', stderr: '', ok: true, ran: s.source } } : {}), ...(two ? { [`${id}_2`]: code(`${id}_2`, s.second!, 'line2.py') } : {}) },
  } as unknown as BoardState
  const target = two ? `${id}_2` : id
  const ev = s.event(target, two ? s.second! : s.source)
  const event = applyClientEvent(board, ev)
  const programs = taskPrograms(event.board, task, 'main.py', ev.type === 'code_run_result' ? ev : undefined)
  const system = [TUTOR_PROMPT, lessonLayer(lesson, summarize(event.board, page), task), buildTaskNudge(task), describeTaskState(event.board, task, programs), describeEvidence(programs)].join('\n\n')
  const llm: Llm = (messages) => deepseek.chat.completions.create({ model: MODEL, stream: true, tools: toolsFor(true, true), messages, thinking: { type: 'disabled' } } as never) as unknown as ReturnType<Llm>
  let called = false
  // The server would also refuse an unrun program; mirror that so the model gets the same feedback.
  const { text } = await runTurn({
    llm, board: event.board, emit: () => {},
    messages: [{ role: 'system', content: system }, { role: 'user', content: event.content }],
    onTaskComplete: async () => {
      if (!hasRun(programs)) throw new Error('the student has not run this exact code yet; ask them to press Run')
      called = true
      return []
    },
  })
  return { called, text }
}

async function main() {
  let bad = 0
  for (const s of SCENARIOS) {
    const { called, text } = await play(s)
    const ok = called === s.complete
    if (!ok) bad++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s.name}: task_complete ${called ? 'called' : 'not called'} (expected ${s.complete ? 'called' : 'not called'})\n      Spark: ${text.slice(0, 140)}`)
  }
  console.log(`\n${SCENARIOS.length - bad}/${SCENARIOS.length} as expected`)
  process.exit(bad ? 1 : 0)
}
void main()
