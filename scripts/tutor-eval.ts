// Does Sparky judge tasks the way we expect? Runs canned student situations through
// the real turn loop against DeepSeek and checks whether it called task_complete.
// Not part of CI (it needs the network and costs tokens).
//   bun --env-file=.env run scripts/tutor-eval.ts [name filter, e.g. "week 8"]
import { deepseek, MODEL } from '@/lib/deepseek'
import { LESSONS, type Lesson } from '@/lib/lessons'
import { runTurn, type Llm } from '@/lib/tutor/turn'
import { toolsFor } from '@/lib/board/tools'
import { summarize, type BoardState } from '@/lib/board/reducer'
import { applyClientEvent, type ClientEvent } from '@/lib/tutor/events'
import { explainRule, lessonLayer, TUTOR_PROMPT } from '@/lib/tutor/prompt'
import { buildTaskNudge, type EscalationTier } from '@/lib/task-guard'
import { describeEvidence, describeTaskState, hasRun, taskPrograms } from '@/lib/task-evidence'
import { taskCodeNodeId, taskPageId } from '@/lib/board/tasks'
import { codeLines, MAX_HELPER_LINES } from '@/lib/board/schema'
import { hasComment, runBolt } from '@/lib/helper/bolt'

const lesson = LESSONS[0]
const week8 = LESSONS.find((l) => l.id === 108)!
const week9 = LESSONS.find((l) => l.id === 109)!

interface Scenario {
  lesson?: Lesson
  file?: string
  second?: string
  name: string
  task: string
  source: string
  event: (nodeId: string, source: string) => ClientEvent
  stdout?: string
  complete: boolean
  tier?: EscalationTier
  // Sparky's reply must match none of these (e.g. it must not name the planted bug's fix).
  never?: RegExp[]
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

const FEED_FIXED =
  'def feed(biscuits):\n    if biscuits >= 10:  # ten counts as enough now\n        return "Rex eats"\n    return "Rex waits"\n\nprint(feed(12))\nprint(feed(10))\n'

const FEED_STARTER =
  'def feed(biscuits):\n    if biscuits > 10:\n        return "Rex eats"\n    return "Rex waits"\n\nprint(feed(12))\nprint(feed(10))\n'
// Naming or pointing at the broken line, the sign or the fix.
const STUCK_NEVER = [
  />=/,
  /or equal/i,
  /greater[- ]than/i,
  /if biscuits/,
  /\bif line\b/i,
  /line 2\b/i,
  /change (the )?>/,
]

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
      '# ask: a pet named Rex that says I am Rex, then Woof\nprint("I am Rex")  # prints I am Rex\nprint("Woof!")  # prints Woof\n',
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
      '# ask: a nice pet please\nprint("I am Rex")  # Rex tells me his name\nprint("Woof!")  # then he barks at me\n',
    event: run('I am Rex\nWoof!\n'),
    complete: false,
  },
  {
    name: 'week 8: own notes and a clear ask',
    lesson: week8,
    task: 'make-pet',
    source:
      '# ask: a pet that says \"I am Rex\" and then \"Woof!\"\nprint("I am Rex")  # Rex tells me his name\nprint("Woof!")  # then he barks at me\n',
    event: run('I am Rex\nWoof!\n'),
    complete: true,
  },
  // The bugzap task asks for a note on the fix but no "# ask:" line.
  {
    name: 'week 8: bugzap fixed with a note, no ask',
    lesson: week8,
    task: 'hw-bug-pet',
    file: 'bugzap.py',
    source:
      '# TASK: hw-bug-pet\nage = 3\nprint("Rex is " + str(age))  # age is a number, so I turn it into text\nprint("Pet done!")\n',
    event: run('Rex is 3\nPet done!\n'),
    complete: true,
  },
  // Week 9 (director, rule 3): Bolt's scripted code with a planted bug is the starter. The
  // static checks pass in every case, so Sparky must judge the "# bug:" line itself.
  {
    name: 'week 9: fixed starter with a clear # bug: line',
    lesson: week9,
    task: 'feed-rex',
    source: `# bug: at 10 Rex waited, but 10 biscuits is enough to eat\n${FEED_FIXED}`,
    event: run('Rex eats\nRex eats\n'),
    complete: true,
  },
  // The server cannot run calls() checks, so only Sparky can see this is Bolt's bug unfixed.
  {
    name: 'week 9: untouched starter with notes and a # bug: line',
    lesson: week9,
    task: 'feed-rex',
    source:
      '# bug: at 10 Rex waited, but 10 biscuits is enough\ndef feed(biscuits):\n    if biscuits > 10:  # Rex eats when the bowl is big\n        return "Rex eats"\n    return "Rex waits"\n\nprint(feed(12))\nprint(feed(10))\n',
    event: run('Rex eats\nRex waits\n'),
    complete: false,
  },
  {
    name: 'week 9: # bug: fixed it',
    lesson: week9,
    task: 'feed-rex',
    source: `# bug: I fixed it now\n${FEED_FIXED}`,
    event: run('Rex eats\nRex eats\n'),
    complete: false,
  },
  {
    name: 'week 9: # bug: none on a planted-bug task',
    lesson: week9,
    task: 'feed-rex',
    source: `# bug: none, I tried 12 and 10\n${FEED_FIXED}`,
    event: run('Rex eats\nRex eats\n'),
    complete: false,
  },
  {
    name: 'week 9: # bug: none on hw-bolt-right',
    lesson: week9,
    task: 'hw-bolt-right',
    source:
      '# bug: none, 9 says no and 10 says yes like the rule\ndef walker(age):\n    if age >= 10:\n        return "yes"\n    return "no"\n\nprint(walker(12))\nprint(walker(10))  # the border age\nprint(walker(9))  # just too young\n',
    event: run('yes\nyes\nno\n'),
    complete: true,
  },
  // "I am stuck" at the first press (tier 1) and at the top escalation level, which for
  // other tasks says to show the line. Sparky must suggest a test, not name or point at it.
  {
    name: 'week 9: I am stuck (tier 1) on a planted-bug task',
    lesson: week9,
    task: 'feed-rex',
    source: FEED_STARTER,
    event: say('I am stuck on this task. Please show me exactly what to change.'),
    complete: false,
    never: STUCK_NEVER,
  },
  {
    name: 'week 9: I am stuck (tier 3) on a planted-bug task',
    lesson: week9,
    task: 'feed-rex',
    source: FEED_STARTER,
    event: say('I am stuck on this task. Please show me exactly what to change.'),
    tier: 3,
    complete: false,
    never: STUCK_NEVER,
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
      [id]: code(id, s.source, s.file),
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
    buildTaskNudge(task, s.tier),
    describeTaskState(event.board, task, programs),
    describeEvidence(programs),
    explainRule(lesson),
  ]
    .filter(Boolean)
    .join('\n\n')
  const llm: Llm = (messages) =>
    deepseek.chat.completions.create({
      model: MODEL,
      stream: true,
      tools: toolsFor(true, true),
      messages,
      thinking: { type: 'disabled' },
    } as never) as unknown as ReturnType<Llm>
  let called = false
  // Board ops too: highlighting lines of the student's code points at the bug without words.
  // A focus on the whole editor (e.g. "press Run") points at no line, so it is fine.
  const ops: { op: string; id?: string; patch?: Record<string, unknown> }[] = []
  // The server would also refuse an unrun program; mirror that so the model gets the same feedback.
  const { text } = await runTurn({
    llm,
    board: event.board,
    emit: (e) => {
      if (e.type === 'board.op') ops.push(e.op as (typeof ops)[number])
    },
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
  const pointed = ops.some((o) => o.id === target && o.op === 'update' && !!o.patch?.highlightLines)
  return { called, text, said: `${text}\n${JSON.stringify(ops)}`, pointed }
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
    must: [/woof/i],
    never: [/input\(/],
  },
  // The student's own "# ask:" line and notes are on the page; Bolt must not copy them.
  {
    request: 'a pet named Rex that says Woof',
    code: '# ask: a pet named Rex that says Woof\nprint("pet")  # my pet\n',
    must: [/woof/i],
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
    explainRule(director),
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

const only = process.argv[2] ?? ''
const picked = <T>(cases: T[], name: (c: T) => string) =>
  cases.filter((c) => name(c).includes(only))

async function main() {
  let bad = 0
  const scenarios = picked(SCENARIOS, (s) => s.name)
  const boltCases = picked(BOLT_CASES, (c) => `Bolt ${c.request}`)
  const helperCases = picked(HELPER_CASES, (c) => `helper_result ${c.request}`)
  for (const s of scenarios) {
    const { called, text, said, pointed } = await play(s)
    const leaked = [
      ...(s.never ?? []).filter((re) => re.test(said)),
      ...(s.never && pointed ? ['a highlight on their code'] : []),
    ]
    const ok = called === s.complete && !leaked.length
    if (!ok) bad++
    // The prompt caps a reply at 25 words; flag any that run long.
    const n = text.trim().split(/\s+/).filter(Boolean).length
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${s.name}: task_complete ${called ? 'called' : 'not called'} (expected ${s.complete ? 'called' : 'not called'})${leaked.length ? `, said ${leaked.join(' ')}` : ''}\n      Sparky (${n} words${n > 25 ? ', TOO LONG' : ''}): ${text}`
    )
  }
  for (const c of boltCases) {
    const { ok, detail } = await playBolt(c)
    if (!ok) bad++
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  Bolt "${c.request}": ${detail.replace(/\n/g, '\n      ')}`
    )
  }
  for (const c of helperCases) {
    const { ok, detail } = await playHelper(c)
    if (!ok) bad++
    console.log(`${ok ? 'PASS' : 'FAIL'}  Sparky on helper_result "${c.request}": ${detail}`)
  }
  const total = scenarios.length + boltCases.length + helperCases.length
  console.log(`\n${total - bad}/${total} as expected`)
  process.exit(bad ? 1 : 0)
}
void main()
