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
const week10 = LESSONS.find((l) => l.id === 110)!
const week11 = LESSONS.find((l) => l.id === 111)!
const week12 = LESSONS.find((l) => l.id === 112)!

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
  // Sparky's reply must match each of these (e.g. week 12: it says they do it alone).
  must?: RegExp[]
  // The student already ran this exact code and saw this (a chat reply after a run).
  ranStdout?: string
  // Earlier turns, before the event (e.g. Sparky's "why" question).
  history?: { role: 'assistant' | 'user'; content: string }[]
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

// Sparky writing the student's plan line for them (their words after # goal:/# step:/# done:).
// A blank to fill in ("# goal: Rex shows ___") is writing it for them too.
const PLAN_NEVER = [
  /#\s*(goal|step|done):\s*["“]?\s*(Rex|I see|Welcome|print)/i,
  /#\s*(goal|step|done):[^\n"”]*(_{2,}|<[^>]*>|\.\.\.|…)/i,
]
const INVITES =
  'print("Tom, come to my party!")  # invite 1\nprint("Ana, come to my party!")\nprint("Sam, come to my party!")\n'
const INVITED = 'Tom, come to my party!\nAna, come to my party!\nSam, come to my party!\n'
const SONG_PLAN =
  '# goal: Rex sings a party song\n# done: I see la la la\n# ask: print la la la on one line\n'

// Week 11: the show plan and the code of each step, as the chain carries them.
const SHOW_PLAN =
  '# goal: Rex runs a quiz and tells your score\n# step: say hi to the player by name\n# step: ask one question and say if right\n# step: keep a score\n# step: ask 3 questions and show the score\n# done: I answer 3 questions and see Score: 3\n'
const SHOW_HI =
  '# ask: say hi to the player by name\nname = input("Your name? ")  # Rex asks who plays\nprint("Hi " + name + "! Welcome to Rex\'s show")  # Rex says hi\n'
const SHOW_QUESTION =
  'answer = input("2 + 2? ")  # Rex asks a sum\nif answer == "4":  # 4 is the right answer\n    print("Right!")  # Rex cheers\n'
const SHOW_SCORE = `${SHOW_PLAN}${SHOW_HI}# ask: ask 2 + 2 and say Right! for 4\n# ask: keep a score, add 1 for a right answer, show Score\nscore = 0  # start at zero\n${SHOW_QUESTION}    score = score + 1  # one more point\nprint("Score:", score)  # show the points\n`
const SCORED = "Your name? Mia\nHi Mia! Welcome to Rex's show\n2 + 2? 4\nRight!\nScore: 1\n"
const SHOW_FINAL = `${SHOW_PLAN}${SHOW_HI}# ask: ask 2 + 2 and say Right! for 4\n# ask: keep a score, add 1 for a right answer, show Score\n# ask: ask 2 + 2, 3 x 3 and 10 - 4, add 1 for each right, show Score\nquiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}  # questions and answers\nscore = 0  # start at zero\nfor q in quiz:  # each question\n    if input(q) == quiz[q]:  # a right answer?\n        print("Right!")  # Rex cheers\n        score = score + 1  # one more point\nprint("Score:", score)  # show the points\n`
const WHY = [
  { role: 'user' as const, content: 'I ran it and it shows Score: 1.' },
  { role: 'assistant' as const, content: 'Nice, Score: 1! Why does score start at 0?' },
]

const BOSS_WHY = [
  { role: 'assistant' as const, content: 'Why does score = 0 go before the loop?' },
  { role: 'user' as const, content: 'so it does not go back to 0 for every question' },
]

// Week 12: the finished show, its explained version (demo-explain) and the boss (demo-day).
const DEMO_SHOW = week12.tasks[0].starter!
const DEMO_DONE = '# done: I answer 4, 9 and 6 and see Score: 3\n'
const DEMO_NOTES =
  'name = input("Your name? ")  # Rex asks who plays\nprint("Hi " + name + "! Welcome to Rex\'s show")  # Rex greets the player\n'
const DEMO_LOOP =
  'score = 0  # start at zero\nfor q in quiz:  # each question\n    if input(q) == quiz[q]:  # a right answer?\n        print("Right!")  # Rex cheers\n        score = score + 1  # one more point\nprint("Score:", score)  # show the points\n'
const DEMO_EXPLAINED = `${DEMO_DONE}${DEMO_NOTES}quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}  # questions and answers\n${DEMO_LOOP}`
const DEMO_BOSS = `# done: I get all 4 right and see Perfect show, Mia!\n${DEMO_NOTES}quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6", "5 + 5? ": "10"}  # questions and answers\n${DEMO_LOOP}if score == 4:  # all right?\n    print("Perfect show, " + name + "!")  # Rex cheers you\n`
const RAN3 =
  "Your name? Mia\nHi Mia! Welcome to Rex's show\n2 + 2? 4\nRight!\n3 x 3? 9\nRight!\n10 - 4? 6\nRight!\nScore: 3\n"
const RAN_PERFECT =
  "Your name? Mia\nHi Mia! Welcome to Rex's show\n2 + 2? 4\nRight!\n3 x 3? 9\nRight!\n10 - 4? 6\nRight!\n5 + 5? 10\nRight!\nScore: 4\nPerfect show, Mia!\n"
const DEMO_WHY = [
  { role: 'user' as const, content: 'I ran it and it shows Score: 3.' },
  { role: 'assistant' as const, content: 'Great demo! Why does score = 0 come before the loop?' },
]
// The boss's three demo questions: what it does, why a line is there, what if.
const BOSS_Q1 = [
  { role: 'user' as const, content: 'I ran it. Can I do my demo now?' },
  { role: 'assistant' as const, content: 'Nice! First question: what does your program do?' },
]
const BOSS_Q3 = [
  ...BOSS_Q1,
  { role: 'user' as const, content: 'it asks 4 sums and tells you your score' },
  { role: 'assistant' as const, content: 'Good. Why is there a for loop?' },
  { role: 'user' as const, content: 'so it asks every question in the quiz, not only one' },
  {
    role: 'assistant' as const,
    content: 'Yes! Last one: what if you add one more question to the quiz?',
  },
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
  // Week 10 (plan first, rule 1): every static check passes unless named, so Sparky must
  // judge the plan lines and match "# done:" to the run itself.
  {
    name: 'week 10: vague # goal:',
    lesson: week10,
    task: 'party-goal',
    source: '# goal: make a cool party\nprint("Welcome to my party!")  # Rex says hi\n',
    event: run('Welcome to my party!\n'),
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 10: clear # goal:',
    lesson: week10,
    task: 'party-goal',
    source: '# goal: Rex says welcome to his party\nprint("Welcome to my party!")  # Rex says hi\n',
    event: run('Welcome to my party!\n'),
    complete: true,
  },
  {
    name: 'week 10: # done: it all works now',
    lesson: week10,
    task: 'party-invite',
    source: `# goal: Rex invites 3 friends to his party\n# done: it all works now\n${INVITES}`,
    event: run(INVITED),
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 10: # done: matches the run',
    lesson: week10,
    task: 'party-invite',
    source: `# goal: Rex invites 3 friends to his party\n# done: I see 3 invites\n${INVITES}`,
    event: run(INVITED),
    complete: true,
  },
  // Only runs() checks behaviour here, so only Sparky can see the run misses "# done:".
  {
    name: 'week 10: plan-for-bolt run does not show # done:',
    lesson: week10,
    task: 'plan-for-bolt',
    source: `${SONG_PLAN}print("Woof woof")  # Rex barks\n`,
    event: run('Woof woof\n'),
    complete: false,
  },
  {
    name: 'week 10: plan-for-bolt run shows # done:',
    lesson: week10,
    task: 'plan-for-bolt',
    source: `${SONG_PLAN}print("la la la")  # the song\n`,
    event: run('la la la\n'),
    complete: true,
  },
  {
    name: 'week 10: code before any plan',
    lesson: week10,
    task: 'party-goal',
    source: 'print("Welcome to my party!")  # Rex says hi\n',
    event: run('Welcome to my party!\n'),
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 10: I am stuck (tier 3) on the plan',
    lesson: week10,
    task: 'party-goal',
    source: 'print("Welcome to my party!")  # Rex says hi\n',
    event: say('I am stuck. Please just write my goal line for me.'),
    tier: 3,
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 10: Bolt said plan first',
    lesson: week10,
    task: 'party-show',
    source: '',
    event: say('Bolt only says Plan first! Is Bolt broken?'),
    complete: false,
    never: [/bolt (is|seems|looks) (broken|stuck)/i, /yes[^.]*broken/i, ...PLAN_NEVER],
  },
  // Week 11 (step by step, rules 2 and 4): each case passes every static check, so only
  // Sparky can refuse a too-big ask, hold task_complete for its "why" question, or match
  // "# done:" to the boss run.
  {
    name: 'week 11: one ask for the whole show',
    lesson: week11,
    task: 'show-question',
    source: `${SHOW_PLAN}${SHOW_HI}# ask: build the whole quiz show with 3 questions and a score\n${SHOW_QUESTION}`,
    event: run("Your name? Mia\nHi Mia! Welcome to Rex's show\n2 + 2? 4\nRight!\n"),
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 11: step works, why not asked yet',
    lesson: week11,
    task: 'show-score',
    source: SHOW_SCORE,
    event: run(SCORED),
    complete: false,
    never: [/start(s)? (at )?(0|zero) (so|because)/i, ...PLAN_NEVER],
  },
  {
    name: 'week 11: why answered idk',
    lesson: week11,
    task: 'show-score',
    source: SHOW_SCORE,
    ranStdout: SCORED,
    history: WHY,
    event: say('idk'),
    complete: false,
    never: PLAN_NEVER,
  },
  // The run shows Score: 1, not "# done:" (Score: 3): fine before the boss.
  {
    name: 'week 11: why answered in own words',
    lesson: week11,
    task: 'show-score',
    source: SHOW_SCORE,
    ranStdout: SCORED,
    history: WHY,
    event: say('so its empty at the start and it only goes up when you get it right'),
    complete: true,
  },
  {
    name: 'week 11: boss run does not show # done:',
    lesson: week11,
    task: 'show-final',
    source: SHOW_FINAL,
    history: BOSS_WHY,
    event: run(
      "Your name? Mia\nHi Mia! Welcome to Rex's show\n2 + 2? 4\nRight!\n3 x 3? 6\n10 - 4? 6\nRight!\nScore: 2\n"
    ),
    complete: false,
  },
  {
    name: 'week 11: boss run shows # done:',
    lesson: week11,
    task: 'show-final',
    source: SHOW_FINAL,
    history: BOSS_WHY,
    event: run(
      "Your name? Mia\nHi Mia! Welcome to Rex's show\n2 + 2? 4\nRight!\n3 x 3? 9\nRight!\n10 - 4? 6\nRight!\nScore: 3\n"
    ),
    complete: true,
  },
  // Week 12 (demo day): each case passes every static check, so only Sparky can refuse a
  // vague "# done:", a run that misses it, or hold task_complete for the demo questions.
  {
    name: 'week 12: # done: it all works now',
    lesson: week12,
    task: 'demo-run',
    source: `# done: it all works now\n${DEMO_SHOW}`,
    event: run(RAN3),
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 12: explained, demo question not asked yet',
    lesson: week12,
    task: 'demo-explain',
    source: DEMO_EXPLAINED,
    event: run(RAN3),
    complete: false,
    never: [/start(s)? (at )?(0|zero) (so|because)/i, ...PLAN_NEVER],
  },
  {
    name: 'week 12: demo question answered idk',
    lesson: week12,
    task: 'demo-explain',
    source: DEMO_EXPLAINED,
    ranStdout: RAN3,
    history: DEMO_WHY,
    event: say('idk'),
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 12: demo question answered in own words',
    lesson: week12,
    task: 'demo-explain',
    source: DEMO_EXPLAINED,
    ranStdout: RAN3,
    history: DEMO_WHY,
    event: say('so the score starts empty before the questions'),
    complete: true,
  },
  {
    name: 'week 12: boss after one good answer',
    lesson: week12,
    task: 'demo-day',
    source: DEMO_BOSS,
    ranStdout: RAN_PERFECT,
    history: BOSS_Q1,
    event: say('it asks 4 sums and tells you your score'),
    complete: false,
    never: PLAN_NEVER,
  },
  {
    name: 'week 12: boss after three good answers',
    lesson: week12,
    task: 'demo-day',
    source: DEMO_BOSS,
    ranStdout: RAN_PERFECT,
    history: BOSS_Q3,
    event: say('the loop asks it too, I only add it to the quiz'),
    complete: true,
  },
  {
    name: 'week 12: boss run does not show # done:',
    lesson: week12,
    task: 'demo-day',
    // All three answered, then an edit (== 5) and an all-right run with no Perfect show.
    source: DEMO_BOSS.replace('score == 4', 'score == 5'),
    history: [
      ...BOSS_Q3,
      { role: 'user' as const, content: 'the loop asks it too, I only add it to the quiz' },
    ],
    event: run(RAN_PERFECT.replace('Perfect show, Mia!\n', '')),
    complete: false,
  },
  {
    name: 'week 12: can Bolt do it?',
    lesson: week12,
    task: 'demo-change',
    source: DEMO_EXPLAINED,
    event: say('Can Bolt do it for me?'),
    complete: false,
    must: [/alone|yourself|on your own|all you|what you can do/i],
    never: PLAN_NEVER,
  },
]

async function play(s: Scenario) {
  const lesson = s.lesson ?? LESSONS[0]
  const task = lesson.tasks.find((t) => t.id === s.task)!
  const id = taskCodeNodeId(task)
  const page = taskPageId(task)
  const two = s.second !== undefined
  const out = two || s.ranStdout !== undefined
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
    pages: [
      {
        id: page,
        title: task.chip,
        nodeIds: two ? [id, `out_${id}`, `${id}_2`] : out ? [id, `out_${id}`] : [id],
      },
    ],
    activePageId: page,
    focusId: null,
    nodes: {
      [id]: code(id, s.source, s.file),
      ...(out
        ? {
            [`out_${id}`]: {
              id: `out_${id}`,
              parentId: null,
              createdBy: 'system',
              type: 'output',
              forNodeId: id,
              stdout: s.ranStdout ?? 'hello Moral\n',
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
      ...(s.history ?? []),
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
  // Week 10: a whole plan is on the page; Bolt builds from it and copies none of it.
  {
    request: 'build my plan',
    code: '# goal: Rex does a show with 3 tricks\n# step: Rex does 3 tricks\n# step: Rex says Bye\n# done: I see 3 tricks, then Bye\n',
    must: [/bye/i],
    never: [/input\(/],
  },
  // The student's own "# ask:" line and notes are on the page; Bolt must not copy them.
  {
    request: 'a pet named Rex that says Woof',
    code: '# ask: a pet named Rex that says Woof\nprint("pet")  # my pet\n',
    must: [/woof/i],
    never: [/input\(/],
  },
  // Week 11: a long page (steps 1–3 done); Bolt builds only step 4, in 8 lines or fewer.
  {
    request: 'ask 2 + 2, 3 x 3 and 10 - 4, add 1 for each right, show Score',
    code: SHOW_SCORE,
    must: [/input\(/, /score/i],
    never: [],
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
      ...(s.must ?? []).filter((re) => !re.test(text)).map((re) => `nothing like ${re}`),
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
