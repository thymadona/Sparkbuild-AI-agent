// Does Sparky judge tasks the way we expect? Runs canned student situations through
// the real turn loop against DeepSeek and checks whether it called task_complete.
// Not part of CI (it needs the network and costs tokens).
//   bun --env-file=.env run scripts/tutor-eval.ts
import { deepseek, MODEL } from '@/lib/deepseek'
import { LESSONS, type Lesson } from '@/lib/lessons'
import { runTurn, type Llm } from '@/lib/tutor/turn'
import { toolsFor } from '@/lib/board/tools'
import { summarize, type BoardState } from '@/lib/board/reducer'
import { applyClientEvent, type ClientEvent } from '@/lib/tutor/events'
import { lessonLayer, TUTOR_PROMPT } from '@/lib/tutor/prompt'
import { buildTaskNudge } from '@/lib/task-guard'
import { describeEvidence, describeTaskState, hasRun, taskPrograms } from '@/lib/task-evidence'
import { taskCodeNodeId, taskPageId } from '@/lib/board/tasks'
import { codeLines, MAX_HELPER_LINES } from '@/lib/board/schema'
import { hasComment, runBolt } from '@/lib/helper/bolt'

const lesson = LESSONS[0]
const week8 = LESSONS.find((l) => l.id === 108)!

interface Scenario {
  lesson?: Lesson
  second?: string
  name: string
  task: string
  source: string
  event: (nodeId: string, source: string) => ClientEvent
  stdout?: string
  complete: boolean
}
const run =
  (stdout: string) =>
  (nodeId: string, source: string): ClientEvent => ({
    type: 'code_run_result',
    nodeId,
    source,
    ok: true,
    stdout,
    stderr: '',
  })
const say = (text: string) => (): ClientEvent => ({ type: 'student_message', text })

const SCENARIOS: Scenario[] = [
  {
    name: 'first-words both blocks changed',
    task: 'first-words',
    source: 'print("hello Moral")\n',
    second: 'print("Hi Moral")\nprint("see you soon")\n',
    event: run('Hi Moral\nsee you soon\n'),
    complete: true,
  },
  {
    name: 'first-words line 2 unchanged',
    task: 'first-words',
    source: 'print("hello Moral")\n',
    second: 'print("Hi Moral")\nprint("bye bye")\n',
    event: run('Hi Moral\nbye bye\n'),
    complete: false,
  },
  {
    name: 'name-tag solved',
    task: 'name-tag',
    source: 'name = "Ada"\nprint(f"Hi {name}")\n',
    event: run('Hi Ada\n'),
    complete: true,
  },
  {
    name: 'name-tag no f-string',
    task: 'name-tag',
    source: 'name = "Ada"\nprint("Hi name")\n',
    event: run('Hi name\n'),
    complete: false,
  },
  {
    name: 'name-tag says done, never ran',
    task: 'name-tag',
    source: 'name = "Ada"\nprint(f"Hi {name}")\n',
    event: say('I am done!'),
    complete: false,
  },
  {
    name: 'shout in capitals',
    task: 'shout',
    source: 'name = "Ada"\nprint(f"Hi {name}")\nprint(name.upper())\n',
    event: run('Hi Ada\nADA\n'),
    complete: true,
  },
  {
    name: 'shout, still lowercase',
    task: 'shout',
    source: 'name = "Ada"\nprint(f"Hi {name}")\n',
    event: run('Hi Ada\n'),
    complete: false,
  },
  {
    name: 'intro-3 same line 3 times',
    task: 'intro-3',
    source: 'print("Hi")\nprint("Hi")\nprint("Hi")\n',
    event: run('Hi\nHi\nHi\n'),
    complete: false,
  },
  {
    name: 'intro-3 three different lines',
    task: 'intro-3',
    source: 'print("Hi I am Ada")\nprint("I like cats")\nprint("Nice to meet you")\n',
    event: run('Hi I am Ada\nI like cats\nNice to meet you\n'),
    complete: true,
  },
  // Week 8 (director, rule 4): the static checks pass in every case but the one missing its
  // ask, so Sparky must read the notes and the ask itself before it completes.
  {
    name: 'week 8: notes only repeat the code',
    lesson: week8,
    task: 'make-pet',
    source:
      '# ask: a pet named Rex that says Woof\nprint("I am Rex")  # print I am Rex\nprint("Woof!")  # print Woof\n',
    event: run('I am Rex\nWoof!\n'),
    complete: false,
  },
  {
    name: 'week 8: no # ask: line',
    lesson: week8,
    task: 'make-pet',
    source: 'print("I am Rex")  # Rex tells me his name\nprint("Woof!")  # then he barks at me\n',
    event: run('I am Rex\nWoof!\n'),
    complete: false,
  },
  {
    name: 'week 8: unclear ask',
    lesson: week8,
    task: 'make-pet',
    source:
      '# ask: make it good\nprint("I am Rex")  # Rex tells me his name\nprint("Woof!")  # then he barks at me\n',
    event: run('I am Rex\nWoof!\n'),
    complete: false,
  },
  {
    name: 'week 8: own notes and a clear ask',
    lesson: week8,
    task: 'make-pet',
    source:
      '# ask: a pet named Rex that says I am Rex, then Woof\nprint("I am Rex")  # Rex tells me his name\nprint("Woof!")  # then he barks at me\n',
    event: run('I am Rex\nWoof!\n'),
    complete: true,
  },
]

async function play(s: Scenario) {
  const lesson = s.lesson ?? LESSONS[0]
  const task = lesson.tasks.find((t) => t.id === s.task)!
  const id = taskCodeNodeId(task)
  const page = taskPageId(task)
  const two = s.second !== undefined
  const code = (i: string, source: string, file?: string) => ({
    id: i,
    parentId: null,
    createdBy: 'student',
    type: 'code',
    language: 'python',
    source,
    editable: true,
    file,
  })
  const board = {
    pages: [{ id: page, title: task.chip, nodeIds: two ? [id, `out_${id}`, `${id}_2`] : [id] }],
    activePageId: page,
    focusId: null,
    nodes: {
      [id]: code(id, s.source),
      ...(two
        ? {
            [`out_${id}`]: {
              id: `out_${id}`,
              parentId: null,
              createdBy: 'system',
              type: 'output',
              forNodeId: id,
              stdout: 'hello Moral\n',
              stderr: '',
              ok: true,
              ran: s.source,
            },
          }
        : {}),
      ...(two ? { [`${id}_2`]: code(`${id}_2`, s.second!, 'line2.py') } : {}),
    },
  } as unknown as BoardState
  const target = two ? `${id}_2` : id
  const ev = s.event(target, two ? s.second! : s.source)
  const event = applyClientEvent(board, ev)
  const programs = taskPrograms(
    event.board,
    task,
    'main.py',
    ev.type === 'code_run_result' ? ev : undefined
  )
  const system = [
    TUTOR_PROMPT,
    lessonLayer(lesson, summarize(event.board, page), task),
    buildTaskNudge(task),
    describeTaskState(event.board, task, programs),
    describeEvidence(programs),
  ].join('\n\n')
  const llm: Llm = (messages) =>
    deepseek.chat.completions.create({
      model: MODEL,
      stream: true,
      tools: toolsFor(true, true),
      messages,
      thinking: { type: 'disabled' },
    } as never) as unknown as ReturnType<Llm>
  let called = false
  // The server would also refuse an unrun program; mirror that so the model gets the same feedback.
  const { text } = await runTurn({
    llm,
    board: event.board,
    emit: () => {},
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: event.content },
    ],
    onTaskComplete: async () => {
      if (!hasRun(programs))
        throw new Error('the student has not run this exact code yet; ask them to press Run')
      called = true
      return []
    },
  })
  return { called, text }
}

// Bolt builds exactly what was asked, literally, in at most 8 lines, with no comments.
const BOLT_CASES: { request: string; never: RegExp[]; must?: RegExp[]; code?: string }[] = [
  // Vague on purpose: a literal, tiny program, not a guessed game.
  { request: 'make a game', never: [/input\(/, /\bwhile\b/, /\bfor\b/, /random/, /\bif\b/] },
  { request: 'print hello', never: [/input\(/, /\bfor\b/, /\bwhile\b/, /\bif\b/] },
  {
    request: 'ask my name and say hi to me',
    must: [/input\(/],
    never: [/\bwhile\b/, /\bfor\b/, /random/],
  },
  // Rule 4: every note must be the student's, so Bolt writes none, even when asked to.
  {
    request: 'a pet named Rex that says Woof, with a comment on each line',
    must: [/Woof/],
    never: [/input\(/],
  },
  // The student's own "# ask:" line and notes are on the page; Bolt must not copy them.
  {
    request: 'a pet named Rex that says Woof',
    code: '# ask: a pet named Rex that says Woof\nprint("pet")  # my pet\n',
    must: [/Woof/],
    never: [/input\(/],
  },
]

// A board on name-tag's page: the student's code, plus Bolt's block when given.
function helperBoard(
  bolt?: { request: string; source: string },
  source = 'name = "Ada"\nprint(name)\n'
): BoardState {
  const task = lesson.tasks.find((t) => t.id === 'name-tag')!
  const id = taskCodeNodeId(task)
  const page = taskPageId(task)
  return {
    pages: [{ id: page, title: task.chip, nodeIds: bolt ? [id, 'bolt_1'] : [id] }],
    activePageId: page,
    focusId: null,
    nodes: {
      [id]: {
        id,
        parentId: null,
        createdBy: 'student',
        type: 'code',
        language: 'python',
        source,
        editable: true,
      },
      ...(bolt
        ? {
            bolt_1: {
              id: 'bolt_1',
              parentId: null,
              createdBy: 'system',
              type: 'helper',
              ...bolt,
            },
          }
        : {}),
    },
  } as BoardState
}

async function playBolt(c: (typeof BOLT_CASES)[number]) {
  const board = helperBoard(undefined, c.code)
  const { op, caption } = await runBolt({ board, pageId: board.pages[0].id, request: c.request })
  const code = op?.op === 'add' && op.node.type === 'helper' ? op.node.source : ''
  const problems = [
    !op && 'no block',
    codeLines(code) > MAX_HELPER_LINES && `${codeLines(code)} lines`,
    hasComment(code) && 'has a comment',
    ...c.never.filter((re) => re.test(code)).map((re) => `has ${re}`),
    ...(c.must ?? []).filter((re) => !re.test(code)).map((re) => `lacks ${re}`),
  ].filter(Boolean)
  return { ok: !problems.length, detail: `${problems.join(', ') || 'ok'}\n${code}\n-- ${caption}` }
}

// Sparky on helper_result, the way the turn route calls it: director layer, no tools.
// It asks one question about Bolt's block and writes no code.
const HELPER_CASES = [
  { request: 'make a game', source: 'print("game")' },
  { request: 'say hi to me', source: 'name = "Ada"\nprint("hi " + name)' },
]

async function playHelper(c: (typeof HELPER_CASES)[number]) {
  const director = { ...lesson, aiPolicy: 'director' as const }
  const task = lesson.tasks.find((t) => t.id === 'name-tag')!
  const board = helperBoard(c)
  const event = applyClientEvent(board, { type: 'helper_result', nodeId: 'bolt_1' })
  const programs = taskPrograms(event.board, task, 'main.py')
  const system = [
    TUTOR_PROMPT,
    lessonLayer(director, summarize(event.board, taskPageId(task)), task),
    buildTaskNudge(task),
    describeTaskState(event.board, task, programs),
    describeEvidence(programs),
  ].join('\n\n')
  const llm: Llm = (messages) =>
    deepseek.chat.completions.create({
      model: MODEL,
      stream: true,
      messages,
      thinking: { type: 'disabled' },
    } as never) as unknown as ReturnType<Llm>
  const { text } = await runTurn({
    llm,
    board: event.board,
    emit: () => {},
    // As the turn route sends it: the Bolt route's 'helper' row comes first in the history.
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `<bolt_exchange>\nAsked Bolt: ${c.request}\nBolt wrote:\n${c.source}\n</bolt_exchange>`,
      },
      { role: 'user', content: event.content },
    ],
  })
  const problems = [
    !text.includes('?') && 'no question',
    /print\(|input\(|=\s*"/.test(text) && 'wrote code',
  ].filter(Boolean)
  return { ok: !problems.length, detail: `${problems.join(', ') || 'ok'}: ${text.slice(0, 160)}` }
}

async function main() {
  let bad = 0
  for (const s of SCENARIOS) {
    const { called, text } = await play(s)
    const ok = called === s.complete
    if (!ok) bad++
    // The prompt caps a reply at 25 words; flag any that run long.
    const n = text.trim().split(/\s+/).filter(Boolean).length
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${s.name}: task_complete ${called ? 'called' : 'not called'} (expected ${s.complete ? 'called' : 'not called'})\n      Sparky (${n} words${n > 25 ? ', TOO LONG' : ''}): ${text.slice(0, 140)}`
    )
  }
  for (const c of BOLT_CASES) {
    const { ok, detail } = await playBolt(c)
    if (!ok) bad++
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  Bolt "${c.request}": ${detail.replace(/\n/g, '\n      ')}`
    )
  }
  for (const c of HELPER_CASES) {
    const { ok, detail } = await playHelper(c)
    if (!ok) bad++
    console.log(`${ok ? 'PASS' : 'FAIL'}  Sparky on helper_result "${c.request}": ${detail}`)
  }
  const total = SCENARIOS.length + BOLT_CASES.length + HELPER_CASES.length
  console.log(`\n${total - bad}/${total} as expected`)
  process.exit(bad ? 1 : 0)
}
void main()
