import type { Lesson, LessonStep, LessonTask, WalkFrame } from './lessons'
import type { TaskCheck } from './task-checks'

// Version 3: the Python course. Ids start at 101: class_enabled_lessons still
// holds rows 1-6 from the retired web course, and those must never re-enable a
// Python week by accident.
//
// Weeks 1-7 the AI is a tutor (aiPolicy 'tutor'); weeks 8-12 the student
// directs it ('director'). Checks are about what the program does, not which
// exact words the student typed: they either match the source loosely or run
// the program (lib/python-checks.ts). Every printed line is something Sparky
// says on screen; `import sparky` adds colors, the vault door and the alarm.

const match = (
  label: string,
  hint: string,
  pattern: string,
  example: string,
  min = 1,
  flags = 'm'
): TaskCheck => ({
  kind: 'sourceMatches',
  label,
  hint,
  pattern,
  flags,
  min,
  example,
})
const output = (
  label: string,
  hint: string,
  pattern: string,
  extra: { flags?: string; file?: string; inputs?: string[] } = {}
): TaskCheck => ({
  kind: 'outputContains',
  label,
  hint,
  pattern,
  ...extra,
})
// Something that happened in Sparky's world: "say:…", "color:…", "door:open", "alarm".
const world = (label: string, hint: string, pattern: string): TaskCheck => ({
  kind: 'worldContains',
  label,
  hint,
  pattern,
  flags: 'm',
})

// The program must finish without an error and print something.
const runs = output('It runs without errors', 'Press Run. Fix any red text.', '\\S')

// Week 3 programs call input(): feed one answer for "how many times?", then three guesses.
const IN = ['3', '1', '9', '7']

const ASSIGN = '^\\s*[a-z_]\\w*\\s*=(?!=)\\s*\\S'
const PRINT_LINE = '^\\s*print\\('
const PRINT_F = '^\\s*print\\(\\s*f["\']'
// A # note after code on the same line. Full-line # comments are the starter's
// own instructions, so they never count.
const NOTE = '^[ \\t]*[^#\\s][^#\\n]*[ \\t]#[ \\t]*\\S'

const WHILE = '^\\s*while\\s+.+:'
const ASK = 'int\\(\\s*input\\('
const RANGE_STEP = '^\\s*for\\s+\\w+\\s+in\\s+range\\(\\s*[^,()]+,\\s*[^,()]+,\\s*[^,()]+\\)\\s*:'
const FOR_IN = '^\\s*for\\s+\\w+\\s+in\\s+\\w+\\s*:'
// Loads the student's file and evaluates a comparison, so 5 and 5.0 both count.
const calls = (label: string, hint: string, call: string, file?: string): TaskCheck => ({
  kind: 'callReturns',
  label,
  hint,
  call,
  equals: 'True',
  ...(file ? { file } : {}),
})
const runs3 = output('It runs without errors', 'Press Run. Fix any red text.', '\\S', {
  inputs: IN,
})

// Predict tasks: the student writes their guess after "# guess:" before running.
const guess = (min = 1): TaskCheck =>
  match(
    min > 1 ? `You wrote ${min} guesses` : 'You wrote your guess',
    'Write your guess after # guess: first.',
    '^\\s*#[ \\t]*guess:[ \\t]*\\S',
    '# guess: 62',
    min
  )

function task(
  id: string,
  type: LessonTask['type'],
  kind: NonNullable<LessonTask['kind']>,
  chip: string,
  success: string,
  prompt: string,
  checks: TaskCheck[],
  boss = false,
  steps?: LessonStep[],
  go?: string,
  then?: LessonTask['then'],
  // Week 1 onward: the task is its own program (no `# TASK:` block in a shared file).
  own?: { starter: string; from?: string }
): LessonTask {
  return {
    id,
    type,
    kind,
    chip,
    success,
    prompt,
    ...(own ? own : { commentAnchor: `TASK: ${id}` }),
    checks,
    ...(boss ? { boss } : {}),
    ...(steps ? { steps } : {}),
    ...(go ? { go } : {}),
    ...(then ? { then } : {}),
  }
}

const choose = (
  prompt: string,
  options: string[],
  answer: number,
  explain: string,
  code?: string
): LessonStep => ({
  kind: 'choose',
  prompt,
  options,
  answer,
  explain,
  ...(code ? { code } : {}),
})
const learn = (
  prompt: string,
  frames: Extract<LessonStep, { kind: 'learn' }>['frames']
): LessonStep => ({ kind: 'learn', prompt, frames })
const walk = (prompt: string, code: string, frames: WalkFrame[]): LessonStep => ({
  kind: 'walk',
  prompt,
  code,
  frames,
})
const stage = (
  scene: 'room' | 'grid' | 'boxes' | 'machine',
  prompt: string,
  config: Record<string, unknown>,
  goal: Record<string, unknown>,
  palette: [string, ...string[]][],
  solution: number[]
): LessonStep => ({
  kind: 'stage',
  scene,
  prompt,
  config,
  goal,
  palette: palette.map(([label, ...ops]) => ({ label, ops })),
  solution,
})
const pairUp = (prompt: string, pairs: [string, string][]): LessonStep => ({
  kind: 'match',
  prompt,
  pairs: pairs.map(([left, right]) => ({ left, right })),
})
const order = (prompt: string, lines: string[]): LessonStep => ({ kind: 'order', prompt, lines })
const bug = (prompt: string, code: string, bugLine: number, explain: string): LessonStep => ({
  kind: 'bug',
  prompt,
  code,
  bugLine,
  explain,
})
const tryIt = (prompt: string, need: number, chips?: string[]): LessonStep => ({
  kind: 'try',
  prompt,
  template: 'print("{}")',
  need,
  ...(chips ? { chips } : {}),
})

export const PY_LESSONS: Lesson[] = [
  {
    id: 101,
    title: 'Week #1 — Wake the Robot',
    description: 'Sparky the robot is asleep. Every line you print gives it a voice.',
    templateFile: 'py/w1.py',
    starterFile: 'main.py',
    extraFiles: { 'bugzap.py': 'py/w1-bugzap.py' },
    scene: 'robot',
    aiPolicy: 'tutor',
    badge: 'Robot Whisperer',
    tasks: [
      task(
        'first-words',
        'core',
        'change',
        'Make Sparky talk',
        'Sparky says your words.',
        'Help me change what Sparky says.',
        [
          // Any line except the starter's own, whatever the quote marks.
          output(
            'Sparky says new words',
            'Change the words inside the quotes.',
            '^(?!beep boop\\s*$)\\S.*$',
            { flags: 'm' }
          ),
          // Line 2 is the second line Sparky says, and it must not still be the starter's.
          output(
            'Line 2 says new words',
            'Change the words on line 2.',
            '^.+\\n(?!bye bye\\s*$)\\S',
            { flags: 'm', file: 'line2.py' }
          ),
        ],
        false,
        [
          // Experience, then induction, prediction, a small try, transfer. The editor comes last.
          learn('Meet print. Watch Sparky.', [
            { code: 'print', note: 'print makes Sparky speak.', hl: 'print' },
            { code: 'print("hello")', note: 'Words go inside quotes.', hl: '"hello"' },
            {
              code: 'print("hello")',
              note: 'Sparky says only the words.',
              hl: 'hello',
              speak: 'hello',
            },
          ]),
          tryIt('Click 2 lines. Watch Sparky.', 2, ['beep boop', 'hello', 'I am Sparky']),
          pairUp('Tap a piece. Tap what it does.', [
            ['print', 'Sparky speaks'],
            ['hi', 'The words'],
            ['" "', 'Around the words'],
          ]),
          choose(
            'What will Sparky say?',
            ['Hi Ada', 'print Hi Ada', '"Hi Ada"'],
            0,
            'The quotes are not spoken. Only Hi Ada.',
            'print("Hi Ada")'
          ),
          order('Hi first, Bye last. Tap the lines.', [
            'print("Hi")',
            'print("I am Sparky")',
            'print("Bye")',
          ]),
          bug(
            'Tap the broken line.',
            'print("Hi")\nprint(wow)\nprint("Bye")',
            1,
            'wow needs quotes.'
          ),
          tryIt('Now you. Type your words. Click Say it.', 1),
        ],
        'Your turn! Change the words inside the quotes. Then press ▶ Run.',
        {
          file: 'line2.py',
          source: 'print("Hi Sparky")\nprint("bye bye")\n',
          go: 'Nice! Here are 2 lines. Change line 2.',
          after: 0,
        },
        { starter: '# Change the words inside the quotes.\nprint("beep boop")\n' }
      ),
      // The wall: three lines about you means typing print three times. Its own
      // program, so the count is 3, not 3 plus whatever first-words left behind.
      task(
        'intro-3',
        'core',
        'make',
        'Tell Sparky about you',
        'Sparky says 3 lines about you.',
        'Help me print three lines about me.',
        [
          match(
            'You print 3 lines',
            'Add three print lines about you.',
            PRINT_LINE,
            'print("Hi")',
            3
          ),
          // Three lines, no two the same: the same print pasted three times does not count.
          output(
            'Sparky says 3 different lines',
            'Make each line say something new.',
            '^(.+)\\n(?!\\1$)(.+)\\n(?!\\1$|\\2$).+',
            { flags: 'm' }
          ),
        ],
        false,
        [
          learn('Sparky reads top to bottom.', [
            { code: 'print("Hi")', note: 'One print. One line.', hl: 'print', speak: 'Hi' },
            {
              code: 'print("Hi")\nprint("Bye")',
              note: 'Sparky goes top to bottom.',
              hl: 'print("Bye")',
              speak: 'Hi',
            },
            {
              code: 'print("Hi")\nprint("I am Sparky")\nprint("Bye")',
              note: 'Last line comes last.',
              hl: 'print("Bye")',
              speak: 'Bye',
            },
          ]),
          choose(
            'Which does Sparky say first?',
            ['Hi', 'Bye', 'Both at once'],
            1,
            'Top line first. Sparky says Bye.',
            'print("Bye")\nprint("Hi")'
          ),
          stage(
            'room',
            'Make Sparky say Hi, I am Sparky, Bye.',
            {},
            { says: ['Hi', 'I am Sparky', 'Bye'] },
            [
              ['print("Bye")', 'say:Bye'],
              ['print("Hi")', 'say:Hi'],
              ['print("I am Sparky")', 'say:I am Sparky'],
            ],
            [1, 2, 0]
          ),
          bug(
            'Tap the line Sparky skips.',
            'print("Hi")\n"I am Sparky"\nprint("Bye")',
            1,
            'Without print, Sparky stays quiet.'
          ),
          tryIt('Say 3 things about you. Click Say it.', 3),
          choose(
            'Sparky must say 3 lines. How many prints?',
            ['One print', 'Three prints', 'Zero prints'],
            1,
            'One print makes one line.'
          ),
        ],
        'Now write 3 print lines about you.',
        undefined,
        {
          starter:
            '# Tell Sparky about you in 3 lines.\n# Line 1: Hi my name is ...\n# Line 2: I like ...\n# Line 3: Nice to meet you ...\n',
        }
      ),
      task(
        'name-tag',
        'core',
        'make',
        'Save your name',
        'Sparky greets you by name.',
        'Help me store my name in a variable.',
        [
          match(
            'You made a name variable',
            'Write name = then your name in quotes.',
            '^\\s*name\\s*=\\s*["\'].+["\']',
            'name = "Ada"'
          ),
          match(
            'You greet with an f-string',
            'Put a letter f before the quotes.',
            `${PRINT_LINE}\\s*f["'][^"'\\n]*\\{name\\}`,
            'print(f"Hi {name}")'
          ),
          runs,
        ],
        false,
        [
          // Do it, name it, predict, spot the error, sequence. The editor comes last.
          stage(
            'boxes',
            'Put Bo in the name box.',
            { boxes: [{ name: 'name' }] },
            { values: { name: 'Bo' } },
            [
              ['name = "Ada"', 'set:name=Ada'],
              ['name = "Bo"', 'set:name=Bo'],
            ],
            [0, 1]
          ),
          learn('Put the box in words.', [
            { code: 'name = "Ada"', note: 'A named box is a variable.', hl: 'name' },
            { code: 'print(f"Hi {name}")', note: 'f-string: words that hold boxes.', hl: 'f' },
            {
              code: 'print(f"Hi {name}")',
              note: '{ } opens the box.',
              hl: '{name}',
              speak: 'Hi Ada',
            },
          ]),
          choose(
            'What will Sparky say?',
            ['Hi Bo', 'Hi name', 'Hi {name}'],
            0,
            '{name} opens the box. Sparky says Hi Bo.',
            'name = "Bo"\nprint(f"Hi {name}")'
          ),
          bug(
            'Tap the broken line.',
            'name = "Ada"\nprint("Hi {name}")',
            1,
            'Add f before the quote.'
          ),
          order('Box first. Then use it.', ['name = "Ada"', 'print(f"Hi {name}")']),
        ],
        'Now save your own name.',
        undefined,
        { starter: '# Save your name in a variable. Then greet yourself with it.\n' }
      ),
      task(
        'shout',
        'core',
        'change',
        'Make it LOUD',
        'Sparky says something in capitals.',
        'Help me make Sparky shout.',
        [
          match(
            'You changed the letters',
            'A string can change its own letters.',
            '\\.upper\\(\\)|\\*\\s*\\d',
            'print(name.upper())'
          ),
          output('Sparky shouts', 'Sparky must say capital letters.', '[A-Z]{2,}', { flags: '' }),
        ],
        false,
        [
          stage(
            'machine',
            'Make hello into HELLO!',
            { input: 'hello' },
            { out: 'HELLO!' },
            [
              ['.upper()', 'upper'],
              ['.lower()', 'lower'],
              ['+ "!"', 'exclaim'],
              ['* 2', 'double'],
            ],
            [0, 2]
          ),
          learn('A word can do tricks.', [
            { code: 'name = "Ada"', note: 'A box holds a word.', hl: 'name' },
            {
              code: 'print(name.upper())',
              note: 'The dot asks for a trick.',
              hl: '.upper()',
              speak: 'ADA',
            },
          ]),
          pairUp('Tap a trick. Tap what it does.', [
            ['.upper()', 'CAPITAL LETTERS'],
            ['.lower()', 'small letters'],
            ['* 3', 'Say it 3 times'],
          ]),
          bug('Tap the broken line.', 'name = "Ada"\nprint(name.upper)', 1, 'Add ( ) after upper.'),
        ],
        'Make Sparky shout your name.',
        undefined,
        { from: 'name-tag', starter: '# Make Sparky say something LOUD.\n' }
      ),
      task(
        'boot-up',
        'core',
        'make',
        'Boss: Boot-up screen',
        'Sparky’s screen is ready.',
        'Help me build my boot-up screen.',
        [
          match('You made 4 variables', 'Save four facts about you.', ASSIGN, 'age = 10', 4, 'mi'),
          match(
            '4 lines use f-strings',
            'Say each fact with an f-string.',
            PRINT_F,
            'print(f"Hi {name}")',
            4
          ),
          match(
            'You added 2 notes with #',
            'A # note goes after your code.',
            NOTE,
            'age = 10  # my age',
            2
          ),
          runs,
        ],
        true,
        [
          learn('Notes are for you.', [
            { code: 'age = 10  # my age', note: 'A # note is for people.', hl: '# my age' },
            {
              code: 'print("Hi")  # Bye',
              note: 'Sparky skips the note.',
              hl: '# Bye',
              speak: 'Hi',
            },
          ]),
          choose(
            'What will Sparky say?',
            ['Hi', 'Bye', 'Hi Bye'],
            0,
            'Sparky skips the note. Only Hi.',
            'print("Hi")  # Bye'
          ),
          order('Boxes first. Then say them.', [
            'name = "Ada"',
            'age = 10',
            'print(f"{name} is {age}")',
          ]),
        ],
        'Build your boot-up screen. 4 facts, 4 lines, 2 notes.',
        undefined,
        {
          from: 'name-tag',
          starter:
            "# BOSS: build Sparky's boot-up screen.\n# Save 4 facts about you in variables.\n# Print 4 lines with f-strings. Add 2 notes at the end of a line.\n",
        }
      ),
      task(
        'paint',
        'choice',
        'make',
        'Paint Sparky',
        'Sparky has a new color.',
        'Help me change Sparky’s color.',
        [
          match(
            'You imported sparky',
            'Bring in Sparky’s tools first.',
            '^\\s*import\\s+sparky',
            'import sparky'
          ),
          match(
            'You called sparky.color',
            'Give sparky.color a color name.',
            '^\\s*sparky\\.color\\(',
            'sparky.color("pink")'
          ),
          world('Sparky changes color', 'Press Run and watch Sparky.', '^color:'),
        ],
        false,
        [
          learn('Sparky has tools.', [
            { code: 'import sparky', note: 'This brings in Sparky’s tools.', hl: 'import' },
            { code: 'sparky.color("pink")', note: 'Now Sparky can change color.', hl: 'color' },
          ]),
          stage(
            'room',
            'Make Sparky pink.',
            {},
            { color: 'pink' },
            [
              ['sparky.color("blue")', 'color:blue'],
              ['sparky.color("pink")', 'color:pink'],
              ['sparky.color("green")', 'color:green'],
            ],
            [1]
          ),
          order('Tools first. Then use them.', ['import sparky', 'sparky.color("pink")']),
        ],
        'Paint Sparky your favorite color.',
        undefined,
        {
          starter:
            '# SIDE QUEST: paint Sparky. Start with: import sparky\n# Then use sparky.color and a color name.\n',
        }
      ),
      task(
        'story',
        'bonus',
        'make',
        'Tell a long story',
        'Sparky tells a story on many lines.',
        'Help me print a long story.',
        [
          match(
            'You used triple quotes',
            'Three quotes hold many lines.',
            `${PRINT_LINE}\\s*(?:"""|''')`,
            'print("""Hi\nthere""")'
          ),
        ],
        false,
        [
          learn('Many lines, one print.', [
            { code: 'print("Hi")', note: 'One print. One line.', hl: 'print', speak: 'Hi' },
            {
              code: 'print("Hi")\nprint("there")',
              note: 'Two lines need two prints.',
              hl: 'print("there")',
              speak: 'there',
            },
            {
              code: 'print("""Hi\nthere""")',
              note: 'Three quotes hold many lines.',
              hl: '"""',
            },
          ]),
          bug('Tap the broken line.', 'print("""Hi\nthere")', 1, 'Close with three quotes.'),
        ],
        'Tell a story on many lines.',
        undefined,
        { starter: '# BONUS: tell a long story with three quotes.\n' }
      ),
      task(
        'hw-add-fact',
        'bonus',
        'make',
        'Add 2 more facts',
        'Sparky shares two more facts.',
        'Help me add two more facts.',
        [
          match(
            'You have 6 variables',
            'Save two more facts in variables.',
            ASSIGN,
            'age = 10',
            6,
            'mi'
          ),
          match(
            '6 lines use f-strings',
            'Say each new fact with an f-string.',
            PRINT_F,
            'print(f"Hi {name}")',
            6
          ),
        ],
        false,
        undefined,
        undefined,
        undefined,
        { from: 'boot-up', starter: '# BONUS: add 2 more facts about you.\n' }
      ),
      task(
        'hw-bug-quote',
        'bonus',
        'bugzap',
        'Fix the crash',
        'bugzap.py runs.',
        'Help me find the mistake in bugzap.py.',
        [
          output('bugzap.py says ready', 'Read the last line of the red text.', 'ready', {
            flags: 'i',
            file: 'bugzap.py',
          }),
        ]
      ),
    ],
  },
  {
    id: 102,
    title: 'Week #2 — The Number Vault',
    description: 'Sparky guards a vault. You write the rules for the door.',
    templateFile: 'py/w2.py',
    starterFile: 'main.py',
    extraFiles: { 'bugzap.py': 'py/w2-bugzap.py' },
    scene: 'vault',
    aiPolicy: 'tutor',
    badge: 'Vault Cracker',
    tasks: [
      task(
        'vault-math',
        'core',
        'predict',
        'Do vault math',
        'Sparky says new math answers.',
        'Help me guess what Sparky says.',
        [
          guess(),
          match(
            'You multiplied',
            'Use the star: *',
            `${PRINT_LINE}.*\\w\\s*\\*\\s*\\w`,
            'print(price * 3)'
          ),
          match(
            'You used // or %',
            'Try the two division tricks.',
            `${PRINT_LINE}.*(?://|%)`,
            'print(coins % price)'
          ),
        ],
        false,
        [
          stage(
            'machine',
            'Turn 5 into 11. Tap the blocks.',
            { input: 5 },
            { out: 11 },
            [
              ['double', 'double'],
              ['add 1', 'add:1'],
              ['add 2', 'add:2'],
            ],
            [0, 1]
          ),
          learn('Watch Sparky do math.', [
            { code: 'print(5 * 3)', note: '* is times. Sparky says 15.', hl: '*', speak: '15' },
            { code: 'print(17 // 5)', note: '// is how many fit.', hl: '//', speak: '3' },
            { code: 'print(17 % 5)', note: '% is what is left: 2.', hl: '%', speak: '2' },
          ]),
          choose(
            'What will Sparky say?',
            ['2', '3.33', '14'],
            0,
            '% is what is left. 20 has three 6s. 2 is left.',
            'print(20 % 6)'
          ),
        ],
        'Change the numbers. Try * // %.'
      ),
      task(
        'true-false',
        'core',
        'predict',
        'True or False?',
        'Sparky says True and False.',
        'Help me guess True or False.',
        [
          guess(2),
          match(
            'You compared two things',
            'Print a question with > or ==.',
            `${PRINT_LINE}.*(?:==|!=|<=|>=|<|>)`,
            'print(coins > price)'
          ),
          output('Sparky says True', 'Ask a question with answer True.', '^True$', { flags: 'm' }),
          output('Sparky says False', 'Ask a question with answer False.', '^False$', {
            flags: 'm',
          }),
        ],
        false,
        [
          learn('A question has two answers.', [
            {
              code: 'print(50 > 12)',
              note: 'Is 50 bigger? Sparky says True.',
              hl: '>',
              speak: 'True',
            },
            { code: 'print(5 == 9)', note: 'Are they the same? False.', hl: '==', speak: 'False' },
          ]),
          pairUp('Tap a piece. Tap what it asks.', [
            ['>', 'bigger than'],
            ['<', 'smaller than'],
            ['==', 'the same as'],
            ['!=', 'not the same'],
          ]),
          bug('Tap the broken line.', 'coins = 50\nprint(coins = 12)', 1, 'Use ==, not =.'),
        ],
        'Write 2 guesses. Ask 2 questions.'
      ),
      task(
        'door-lock',
        'core',
        'make',
        'Lock the door',
        'The door opens for the right code.',
        'Help me lock the door with an if.',
        [
          match(
            'You wrote an if rule',
            'Ask: does guess equal secret?',
            '^\\s*if\\s+.+:\\s*$',
            'if guess == secret:'
          ),
          match(
            'You wrote an else rule',
            'else covers every other code.',
            '^\\s*else\\s*:',
            'else:'
          ),
          world('The door moves', 'Use a door tool inside your rule.', '^door:'),
          runs,
        ],
        false,
        [
          learn('A rule asks a question first.', [
            { code: 'if guess == secret:', note: 'Right code? Then do this.', hl: 'if' },
            {
              code: '    sparky.open_door()',
              note: 'The space means: inside the rule.',
              hl: '    ',
            },
            { code: 'else:', note: 'Any other code? Do this.', hl: 'else' },
            { code: '    sparky.close_door()', note: 'Only one door happens.' },
          ]),
          order('Build the rule. Tap the lines.', [
            'if guess == secret:',
            '    sparky.open_door()',
            'else:',
            '    sparky.close_door()',
          ]),
          choose(
            'Which door does Sparky use?',
            ['open', 'closed', 'open and closed'],
            1,
            '5 is not 9. So else runs.',
            'secret = 9\nguess = 5\nif guess == secret:\n    print("open")\nelse:\n    print("closed")'
          ),
        ],
        'Change guess. Test both doors.'
      ),
      task(
        'three-doors',
        'core',
        'make',
        'Add a warm door',
        'Sparky has three doors.',
        'Help me add a third door with elif.',
        [
          match(
            'You wrote an elif rule',
            'elif goes between if and else.',
            '^\\s*elif\\s+.+:\\s*$',
            'elif guess > 1000:'
          ),
          runs,
        ],
        false,
        [
          learn('Add a door in the middle.', [
            { code: 'if guess == secret:', note: 'First question.', hl: 'if' },
            { code: 'elif guess > 1000:', note: 'Another question. Middle door.', hl: 'elif' },
            { code: 'else:', note: 'Nothing fits? Do this.', hl: 'else' },
          ]),
          choose(
            'What will Sparky say?',
            ['big', 'huge', 'big and huge'],
            0,
            'First yes wins.',
            'guess = 2000\nif guess > 100:\n    print("big")\nelif guess > 1000:\n    print("huge")'
          ),
          bug(
            'Tap the broken line.',
            'if guess == 1:\n    print("open")\nelse:\n    print("closed")\nelif guess > 5:\n    print("warm")',
            4,
            'elif goes before else.'
          ),
        ],
        'Add a warm door with elif.'
      ),
      task(
        'vault-guard',
        'core',
        'make',
        'Boss: Vault guard',
        'Open, closed, or alarm.',
        'Help me build the vault guard.',
        [
          match(
            'A rule uses < or >',
            'Is the guess bigger or smaller?',
            '^\\s*(?:el)?if\\s.*[<>]',
            'elif guess > secret:'
          ),
          match(
            'You sound the alarm',
            'Use the alarm tool for wrong codes.',
            '^\\s*sparky\\.alarm\\(',
            'sparky.alarm()'
          ),
          match(
            'Every door does something',
            'Each door needs its own action.',
            '^[ \\t]+(?:print|sparky\\.\\w+)\\(',
            '    print("Door open!")',
            3
          ),
          runs,
        ],
        true,
        [
          pairUp('Tap a tool. Tap when to use it.', [
            ['sparky.open_door()', 'Right code'],
            ['sparky.close_door()', 'Close guess'],
            ['sparky.alarm()', 'Way off'],
          ]),
          bug(
            'Tap the broken line.',
            'if guess > 0:\n    sparky.alarm()\nelif guess == secret:\n    sparky.open_door()\nelse:\n    sparky.close_door()',
            0,
            'This rule wins for every code.'
          ),
        ],
        'Build 3 doors. Alarm last.'
      ),
      task(
        'and-or',
        'choice',
        'change',
        'Try and / or',
        'A rule uses and, or or.',
        'Help me use and or or in a rule.',
        [
          match(
            'A rule uses and or or',
            'Join two questions in one if.',
            '^\\s*(?:el)?if\\s.*\\b(?:and|or)\\b.*:',
            'if guess > 0 and guess < 9999:'
          ),
        ],
        false,
        [
          learn('Join two questions.', [
            { code: 'guess > 0 and guess < 9999', note: 'and: both must be True.', hl: 'and' },
            { code: 'guess < 0 or guess > 9999', note: 'or: one True is enough.', hl: 'or' },
          ]),
          pairUp('Tap a word. Tap what it needs.', [
            ['and', 'Both are True'],
            ['or', 'One is enough'],
          ]),
          choose(
            'What will Sparky say?',
            ['True', 'False', '5'],
            1,
            'and needs both. 5 > 9 is False.',
            'print(5 > 1 and 5 > 9)'
          ),
        ],
        'Join two questions in one if.'
      ),
      task(
        'even-odd',
        'bonus',
        'make',
        'Even or odd?',
        'Sparky tells even from odd.',
        'Help me find even and odd numbers.',
        [
          match(
            'You used % 2',
            'Even numbers have nothing left over.',
            '%\\s*2\\s*==',
            'if coins % 2 == 0:'
          ),
          match(
            'Sparky says even or odd',
            'Print "even" or "odd".',
            `${PRINT_LINE}.*(?:even|odd)`,
            'print("even")',
            1,
            'mi'
          ),
        ],
        false,
        [
          stage(
            'boxes',
            'Take pairs of coins. Leave 1.',
            { boxes: [{ name: 'coins', value: 7 }] },
            { values: { coins: 1 } },
            [
              ['take a pair', 'add:coins:-2'],
              ['add 1', 'add:coins:1'],
            ],
            [0, 0, 0]
          ),
          choose(
            'What will Sparky say?',
            ['0', '5', '1'],
            0,
            '10 makes 5 pairs. Nothing is left.',
            'print(10 % 2)'
          ),
          order('Build the rule. Tap the lines.', [
            'if coins % 2 == 0:',
            '    print("even")',
            'else:',
            '    print("odd")',
          ]),
        ],
        'Change coins. Even or odd?'
      ),
      task(
        'hw-discount',
        'bonus',
        'make',
        'Shop discount',
        'Big totals get a discount.',
        'Help me give a discount on big totals.',
        [
          match(
            'You check the total',
            'Ask: is the total over 50?',
            '^\\s*(?:el)?if\\s+total\\s*[<>]',
            'if total > 50:'
          ),
          output(
            'Sparky says the new total',
            'Take 10 off, or 10 percent.',
            '\\b(?:70|72)(?:\\.0)?\\b'
          ),
        ]
      ),
      task(
        'hw-bug-equals',
        'bonus',
        'bugzap',
        'Fix the door',
        'bugzap.py opens the door.',
        'Help me find the mistake in bugzap.py.',
        [
          output('bugzap.py opens the door', 'Read the last line of the red text.', 'open', {
            flags: 'i',
            file: 'bugzap.py',
          }),
        ]
      ),
    ],
  },
  {
    id: 103,
    title: 'Week #3 — Repeat Reactor',
    description: 'The reactor needs a countdown and a code lock. A loop repeats work for you.',
    templateFile: 'py/w3.py',
    starterFile: 'main.py',
    extraFiles: { 'bugzap.py': 'py/w3-bugzap.py' },
    scene: 'robot',
    aiPolicy: 'tutor',
    badge: 'Loop Master',
    tasks: [
      task(
        'count-down',
        'core',
        'predict',
        'Count with a loop',
        'Sparky counts up to 3.',
        'Help me guess what the loop prints.',
        [
          guess(),
          output('Sparky counts to 3', 'Change the number inside range().', '^3$', {
            flags: 'm',
            inputs: IN,
          }),
        ],
        false,
        [
          stage(
            'grid',
            'Get both gems. Try repeat!',
            {
              w: 4,
              h: 2,
              start: { x: 0, y: 0, dir: 'E' },
              gems: [
                [3, 0],
                [3, 1],
              ],
            },
            {},
            [
              ['move', 'move'],
              ['turn right', 'right'],
              ['turn left', 'left'],
              ['repeat 3: move', 'move', 'move', 'move'],
            ],
            [3, 1, 0]
          ),
          walk('Step through the loop.', 'for i in range(3):\n    print(i)', [
            { line: 1, vars: {}, note: 'Start: no i yet.' },
            { line: 2, vars: { i: '0' }, note: 'i is 0. Now print.' },
            { line: 1, vars: { i: '0' }, out: '0', note: 'Printed 0. Back to for.' },
            { line: 2, vars: { i: '1' }, out: '0', note: 'i is 1.' },
            { line: 1, vars: { i: '1' }, out: '0\n1', note: 'Printed 1.' },
            { line: 2, vars: { i: '2' }, out: '0\n1', note: 'i is 2.' },
            { line: 1, vars: { i: '2' }, out: '0\n1\n2', note: 'Printed 2. The loop ends.' },
          ]),
        ],
        'Now guess what the loop prints.'
      ),
      task(
        'times-table',
        'core',
        'change',
        'Count by twos',
        'Sparky counts in steps.',
        'Help me count with a step.',
        [
          match(
            'You gave range a step',
            'range(start, stop, step) takes three numbers.',
            RANGE_STEP,
            'for n in range(2, 12, 2):'
          ),
          runs3,
        ]
      ),
      task(
        'hold-line',
        'core',
        'make',
        'Stop the loop',
        'A while loop stops with break.',
        'Help me stop a while loop.',
        [
          match(
            'You wrote a while loop',
            'Write while, a question, then a colon.',
            WHILE,
            'while count < 3:'
          ),
          match('You used break', 'break ends the loop early.', '^\\s+break\\b', '    break'),
          match(
            'Your counter goes up',
            'Add 1 to your counter each time.',
            '^\\s*(\\w+)\\s*(?:\\+=|-=|=\\s*\\1\\s*[+-])',
            'count += 1'
          ),
          runs3,
        ]
      ),
      task(
        'ask-repeat',
        'core',
        'make',
        'Ask and repeat',
        'Sparky repeats as you ask.',
        'Help me ask for a number and repeat.',
        [
          match(
            'You used input()',
            'Turn the answer into a number with int().',
            ASK,
            'times = int(input("How many? "))'
          ),
          match(
            'A loop uses your number',
            'Put your number inside range().',
            '^\\s*for\\s+\\w+\\s+in\\s+range\\(\\s*(?:[A-Za-z_]\\w*|int\\(\\s*input)',
            'for i in range(times):'
          ),
          runs3,
        ],
        false,
        [
          stage(
            'machine',
            'Machine: turn 4 into 9.',
            { input: 4 },
            { out: 9 },
            [
              ['double', 'double'],
              ['add 1', 'add:1'],
              ['add 2', 'add:2'],
            ],
            [0, 1]
          ),
        ],
        'Now ask for a number in code.'
      ),
      task(
        'guess-number',
        'core',
        'make',
        'Boss: Guess the number',
        'Sparky says higher or lower.',
        'Help me build the guess game.',
        [
          match('You wrote a while loop', 'Repeat until the guess is right.', WHILE, 'while True:'),
          match(
            'You ask for a guess',
            'Use int(input()) inside the loop.',
            ASK,
            'guess = int(input("Guess: "))'
          ),
          output('Sparky says higher', 'Keep secret = 7 so Sparky can test.', 'higher', {
            flags: 'i',
            inputs: IN,
          }),
          output('Sparky says lower', 'A guess over 7 needs Lower.', 'lower', {
            flags: 'i',
            inputs: IN,
          }),
        ],
        true
      ),
      task(
        'stars',
        'choice',
        'make',
        'Star triangle',
        'Sparky draws stars.',
        'Help me print a star triangle.',
        [
          match(
            'You multiplied a star',
            'Try "*" * 3 inside print.',
            '^\\s*print\\(\\s*["\']\\*["\']\\s*\\*',
            'print("*" * i)'
          ),
          output('Stars are on screen', 'Press Run and look for **.', '^\\*{2,}$', {
            flags: 'm',
            inputs: IN,
          }),
        ]
      ),
      task(
        'total',
        'bonus',
        'make',
        'Add up 1 to 100',
        'Sparky says the total.',
        'Help me add up 1 to 100.',
        [output('Sparky says 5050', 'Add each number to a total.', '\\b5050\\b', { inputs: IN })]
      ),
      task(
        'hw-countdown',
        'bonus',
        'make',
        'Launch countdown',
        'Sparky counts down, then launches.',
        'Help me count down and launch.',
        [
          match(
            'You counted down',
            'Use range with a step of -1.',
            'range\\([^)]*,\\s*-\\d+\\s*\\)',
            'for n in range(5, 0, -1):'
          ),
          output(
            'Sparky says launch',
            'Print a launch message at the end.',
            'launch|liftoff|blast',
            { flags: 'i', inputs: IN }
          ),
        ]
      ),
      task(
        'hw-explain',
        'bonus',
        'explain',
        'Explain the loop',
        'Each line has a # note.',
        'Help me explain the loop lines.',
        [
          match(
            'You added 2 notes with #',
            'A # note goes after your code.',
            NOTE,
            'age = 10  # my age',
            2
          ),
        ]
      ),
      task(
        'hw-bug-loop',
        'bonus',
        'bugzap',
        'Fix the countdown',
        'bugzap.py counts down.',
        'Help me find the mistakes in bugzap.py.',
        [
          output('bugzap.py says Liftoff', 'Read the last line of the red text.', 'liftoff', {
            flags: 'i',
            file: 'bugzap.py',
          }),
        ]
      ),
    ],
  },
  {
    id: 104,
    title: 'Week #4 — Inventory Raid',
    description: 'Raid the dungeon! Your backpack is a list of loot.',
    templateFile: 'py/w4.py',
    starterFile: 'main.py',
    extraFiles: { 'bugzap.py': 'py/w4-bugzap.py' },
    scene: 'robot',
    aiPolicy: 'tutor',
    badge: 'Loot Lord',
    tasks: [
      task(
        'backpack',
        'core',
        'predict',
        'Open the backpack',
        'Sparky shows the last item.',
        'Help me guess what the list prints.',
        [
          guess(),
          output('Sparky shows torch', 'Print the last item. Try backpack[-1].', '^torch$', {
            flags: 'm',
          }),
        ],
        false,
        [
          learn('A list has numbered slots.', [
            { code: 'backpack = ["sword", "map", "torch"]', note: 'A list holds many items.' },
            { code: 'backpack[0]', note: 'Slot 0 is first: sword.', hl: '0', speak: 'sword' },
            { code: 'backpack[-1]', note: '-1 is last: torch.', hl: '-1', speak: 'torch' },
          ]),
          walk('Step through the list.', 'bag = ["sword", "map", "torch"]\nprint(bag[1])', [
            { line: 1, vars: {}, note: 'Make the list first.' },
            {
              line: 2,
              vars: { bag: ["'sword'", "'map'", "'torch'"] },
              note: 'bag[1] is slot 1: map.',
            },
          ]),
          pairUp('Tap a piece. Tap what it gets.', [
            ['[0]', 'First item'],
            ['[-1]', 'Last item'],
            ['len()', 'How many'],
          ]),
          choose(
            'What will Sparky say?',
            ['sword', 'map', 'torch'],
            1,
            'Slots start at 0. Slot 1 is map.',
            'backpack = ["sword", "map", "torch"]\nprint(backpack[1])'
          ),
        ],
        'Print the last item too.'
      ),
      task(
        'loot-loop',
        'core',
        'make',
        'Loot loop',
        'Sparky shows every item.',
        'Help me loop over my backpack.',
        [
          match(
            'You looped over your list',
            'Write for item in backpack:',
            FOR_IN,
            'for item in backpack:'
          ),
          match(
            'The loop prints each item',
            'Indent a print under the for line.',
            '^[ \\t]+print\\(',
            '    print(item)'
          ),
          runs,
        ],
        false,
        [
          learn('A loop visits every item.', [
            { code: 'for item in backpack:', note: 'One item at a time.', hl: 'item' },
            { code: '    print(item)', note: 'Runs for each item.', hl: 'print' },
          ]),
          pairUp('Tap a word. Tap its job.', [
            ['for', 'Repeat'],
            ['item', 'One thing'],
            ['backpack', 'The whole list'],
          ]),
          bug(
            'Tap the broken line.',
            'for item in backpack:\n    print(items)',
            1,
            'Use the same name: item.'
          ),
        ],
        'Print every item with a loop.'
      ),
      task(
        'grab-drop',
        'core',
        'make',
        'Grab and drop',
        'Items go in and out.',
        'Help me add and remove items.',
        [
          match(
            'You added with append',
            'Try backpack.append("potion")',
            '^\\s*\\w+\\.append\\(',
            'backpack.append("potion")'
          ),
          match(
            'You dropped with remove',
            'Try backpack.remove("map")',
            '^\\s*\\w+\\.remove\\(',
            'backpack.remove("map")'
          ),
          match(
            'You checked with in',
            'Ask first: if "map" in backpack:',
            '^\\s*if\\s+.*\\bin\\b',
            'if "map" in backpack:'
          ),
          runs,
        ],
        false,
        [
          learn('Change your backpack.', [
            { code: 'backpack.append("potion")', note: 'Added to the end.', hl: 'append' },
            { code: 'backpack.remove("map")', note: 'The map is gone.', hl: 'remove' },
            { code: '"map" in backpack', note: 'Sparky says True or False.', hl: 'in' },
          ]),
          order('Ask first. Then drop.', [
            'if "map" in backpack:',
            '    backpack.remove("map")',
            'print(backpack)',
          ]),
          choose(
            'What will Sparky say?',
            ['True', 'map', '1'],
            0,
            'in asks a question. The answer is True.',
            'backpack = ["sword", "map"]\nprint("map" in backpack)'
          ),
        ],
        'Grab a potion. Drop the map. Ask first.'
      ),
      task(
        'item-stats',
        'core',
        'make',
        'Item stats',
        'Each item has a power.',
        'Help me store powers in a dict.',
        [
          match(
            'You looped with .items()',
            'Write for name, power in stats.items():',
            '^\\s*for\\s+\\w+\\s*,\\s*\\w+\\s+in\\s+\\w+\\.items\\(\\)\\s*:',
            'for name, power in stats.items():'
          ),
          runs,
        ],
        false,
        [
          stage(
            'boxes',
            'Make the sword 7. Make the shield 5.',
            {
              boxes: [
                { name: 'sword', value: 5 },
                { name: 'shield', value: 3 },
                { name: 'bow', value: 4 },
              ],
            },
            { values: { sword: 7, shield: 5 } },
            [
              ['sword = 7', 'set:sword=7'],
              ['shield = 5', 'set:shield=5'],
              ['bow = 1', 'set:bow=1'],
            ],
            [0, 1]
          ),
          learn('A dict pairs a name with a value.', [
            { code: 'stats = {"sword": 5}', note: 'Name, then power.' },
            { code: 'stats["sword"]', note: 'Ask by name: 5.', hl: '"sword"', speak: '5' },
            {
              code: 'for name, power in stats.items():',
              note: 'Name and power together.',
              hl: 'items',
            },
          ]),
          bug(
            'Tap the broken line.',
            'stats = {"sword": 5}\nprint(stats[0])',
            1,
            'Use the name: stats["sword"]'
          ),
        ],
        'Make a dict. Loop with .items().'
      ),
      task(
        'loot-report',
        'core',
        'make',
        'Boss: Loot report',
        'Sparky says total, best item, count.',
        'Help me build the loot report.',
        [
          output('Sparky says total power 12', 'Add up every power in loot.', '\\b12\\b'),
          output(
            'Sparky names the best item',
            'Print the item with the top power.',
            '(?:best|top|strong\\w*)\\D*sword|sword\\D*(?:best|top|strong\\w*)',
            { flags: 'i' }
          ),
          match(
            'You counted the items',
            'len() counts what is in loot.',
            '\\blen\\(\\s*\\w+\\s*\\)',
            'print(len(loot))',
            2
          ),
        ],
        true,
        [
          choose(
            'What will Sparky say?',
            ['5', '3', '2'],
            0,
            'total keeps adding. 2 + 3 is 5.',
            'total = 0\nfor n in [2, 3]:\n    total = total + n\nprint(total)'
          ),
          bug(
            'Tap the broken line.',
            'for name, power in loot.items():\n    total = 0\n    total = total + power\nprint(total)',
            1,
            'Start total before the loop.'
          ),
        ],
        'Print total power, best item, and count.'
      ),
      task(
        'sort-loot',
        'choice',
        'make',
        'Sort the loot',
        'The loot is in ABC order.',
        'Help me sort my loot.',
        [
          match(
            'You sorted the loot',
            'Try print(sorted(backpack))',
            '^[^#\\n]*\\bsorted\\(|^\\s*\\w+\\.sort\\(',
            'print(sorted(backpack))'
          ),
        ],
        false,
        [
          learn('Put loot in ABC order.', [
            { code: 'sorted(backpack)', note: 'ABC order. A new list.', hl: 'sorted' },
            { code: 'backpack', note: 'The backpack stays the same.' },
          ]),
          choose(
            'What will Sparky say?',
            ["['map', 'axe']", "['axe', 'map']"],
            0,
            'sorted makes a new list. backpack stays.',
            'backpack = ["map", "axe"]\nsorted(backpack)\nprint(backpack)'
          ),
        ],
        'Print your loot in ABC order.'
      ),
      task(
        'trade',
        'bonus',
        'make',
        'Trade an item',
        'Sparky trades one item away.',
        'Help me trade an item.',
        [
          match(
            'You used pop()',
            'pop() takes the last item out.',
            '\\.pop\\(',
            'traded = backpack.pop()'
          ),
          runs,
        ],
        false,
        [
          learn('Trade the last item.', [
            { code: 'traded = backpack.pop()', note: 'The last item leaves.', hl: 'pop' },
            { code: 'print(traded)', note: 'traded holds it. Sparky says it.', hl: 'traded' },
          ]),
          bug(
            'Tap the broken line.',
            'traded = backpack.pop\nprint(traded)',
            0,
            'Add ( ) after pop.'
          ),
        ],
        'Trade the last item. Print it.'
      ),
      task(
        'hw-shopping',
        'bonus',
        'make',
        'Shopping list',
        'A list of five things.',
        'Help me make a shopping list.',
        [
          match(
            'Your list has 5 things',
            'Put five things inside [ ].',
            '^\\s*\\w+\\s*=\\s*\\[(?:[^\\[\\],]+,){4,}[^\\[\\],]+\\]',
            'shopping = ["a", "b", "c", "d", "e"]'
          ),
          runs,
        ]
      ),
      task(
        'hw-comment',
        'bonus',
        'explain',
        'Explain the prices',
        'Each line has a # note.',
        'Help me explain each line.',
        [
          match(
            'You added 3 notes with #',
            'A # note goes after your code.',
            NOTE,
            'age = 10  # my age',
            3
          ),
        ]
      ),
      task(
        'hw-bug-index',
        'bonus',
        'bugzap',
        'Fix the crash',
        'bugzap.py finishes.',
        'Help me find the mistake in bugzap.py.',
        [
          output('bugzap.py says done', 'Read the last line of the red text.', 'done', {
            flags: 'i',
            file: 'bugzap.py',
          }),
        ]
      ),
    ],
  },
  {
    id: 105,
    title: 'Week #5 — The Spell Book',
    description: 'Spells are functions. Write one spell, cast it many times.',
    templateFile: 'py/w5.py',
    starterFile: 'main.py',
    extraFiles: { 'bugzap.py': 'py/w5-bugzap.py' },
    scene: 'robot',
    aiPolicy: 'tutor',
    badge: 'Spell Caster',
    tasks: [
      task(
        'first-spell',
        'core',
        'make',
        'Your first spell',
        'Sparky casts your spell.',
        'Help me write my first spell.',
        [
          match(
            'You wrote a spell with def',
            'Write def cast(): then indent the body.',
            '^\\s*def\\s+\\w+\\(\\s*\\)\\s*:',
            'def cast():'
          ),
          match(
            'You cast the spell',
            'Call it by its name: cast()',
            '^(?!print\\b)[a-z_]\\w*\\(\\s*\\)\\s*$',
            'cast()'
          ),
          runs,
        ],
        false,
        [
          stage(
            'machine',
            'Turn hi into HI! Tap the blocks.',
            { input: 'hi' },
            { out: 'HI!' },
            [
              ['upper', 'upper'],
              ['exclaim', 'exclaim'],
              ['lower', 'lower'],
            ],
            [0, 1]
          ),
          learn('A spell waits until you cast it.', [
            { code: 'def cast():', note: 'Write the spell. Nothing runs yet.', hl: 'def' },
            { code: '    print("Boom!")', note: 'Indent means inside the spell.' },
            { code: 'cast()', note: 'Cast it. Now Sparky speaks.', speak: 'Boom!' },
          ]),
          walk('Step through the spell.', 'def cast():\n    print("Boom!")\ncast()', [
            { line: 1, vars: {}, stack: ['<module>'], note: 'def only saves the spell.' },
            { line: 3, vars: {}, stack: ['<module>'], note: 'cast() runs it.' },
            { line: 2, vars: {}, stack: ['<module>', 'cast'], note: 'Now the spell prints.' },
          ]),
          order('Write first. Cast last.', ['def cast():', '    print("Boom!")', 'cast()']),
        ],
        'Write a spell. Then cast it.'
      ),
      task(
        'target-spell',
        'core',
        'make',
        'Spell with a target',
        'The spell knows its target.',
        'Help me give my spell a target.',
        [
          match(
            'Your spell has a parameter',
            'Put a name inside the ( ).',
            '^\\s*def\\s+\\w+\\(\\s*\\w+',
            'def zap(target):'
          ),
          match(
            'You cast it with a target',
            'Call it like zap("Ghost").',
            '^(?!print\\b)[a-z_]\\w*\\(\\s*(?:["\']|\\w)',
            'zap("Ghost")'
          ),
          runs,
        ],
        false,
        [
          learn('A spell can have a target.', [
            { code: 'def zap(target):', note: 'target is a slot: a parameter.', hl: 'target' },
            { code: '    print(f"Zap {target}")', note: 'The slot is used here.' },
            { code: 'zap("Ghost")', note: 'Ghost goes in the slot.', hl: '"Ghost"' },
          ]),
          pairUp('Tap a piece. Tap its job.', [
            ['zap', 'Spell name'],
            ['target', 'Empty slot'],
            ['"Ghost"', 'What goes in'],
          ]),
          bug(
            'Tap the broken line.',
            'def zap(target):\n    print(f"Zap {target}")\nzap()',
            2,
            'Give it a target: zap("Ghost").'
          ),
        ],
        'Give your spell a target.'
      ),
      task(
        'damage',
        'core',
        'make',
        'Damage spell',
        'The spell returns a number.',
        'Help me return a number from a spell.',
        [
          match(
            'You used return',
            'return sends a value back.',
            '^\\s+return\\s+\\S',
            '    return power * 2'
          ),
          calls('damage(5) gives 10', 'Return power * 2.', 'damage(5) == 10'),
        ],
        false,
        [
          stage(
            'machine',
            'Turn 3 into 10. Tap the blocks.',
            { input: 3 },
            { out: 10 },
            [
              ['add 2', 'add:2'],
              ['double', 'double'],
              ['add 1', 'add:1'],
            ],
            [0, 1]
          ),
          learn('A spell can give a number back.', [
            { code: '    return power * 2', note: 'return sends the answer back.', hl: 'return' },
            { code: 'damage(5)', note: 'Gives back 10.', speak: '10' },
          ]),
          choose(
            'What will Sparky say?',
            ['8', '4', '2'],
            0,
            'damage(4) gives back 4 * 2. That is 8.',
            'def damage(power):\n    return power * 2\nprint(damage(4))'
          ),
        ],
        'Make damage return a number.'
      ),
      task(
        'dice',
        'core',
        'make',
        'Roll the dice',
        'Sparky rolls a number.',
        'Help me roll a dice.',
        [
          match(
            'You imported random',
            'Start with import random.',
            '^\\s*import\\s+random',
            'import random'
          ),
          match(
            'You rolled with randint',
            'Try random.randint(1, 6).',
            '^[^#\\n]*random\\.randint\\(',
            'roll = random.randint(1, 6)'
          ),
          runs,
        ],
        false,
        [
          learn('Get a dice tool.', [
            { code: 'import random', note: 'Get the dice tool.', hl: 'import' },
            { code: 'random.randint(1, 6)', note: 'A number from 1 to 6.', hl: 'randint' },
          ]),
          pairUp('Tap a piece. Tap its job.', [
            ['import', 'Get a tool'],
            ['randint', 'Pick a number'],
            ['(1, 6)', 'Lowest and highest'],
          ]),
          bug(
            'Tap the broken line.',
            'roll = random.randint(1, 6)\nprint(roll)',
            0,
            'Add import random first.'
          ),
        ],
        'Roll the dice. Print it.'
      ),
      task(
        'battle-round',
        'core',
        'make',
        'Boss: Battle round',
        'You beat the monster.',
        'Help me build the battle round.',
        [
          match(
            'You wrote a while loop',
            'Keep hitting while HP is above 0.',
            WHILE,
            'while monster_hp > 0:'
          ),
          match(
            'The loop uses damage()',
            'Call damage() inside the loop.',
            '^[ \\t]+[^#\\n]*\\bdamage\\(',
            '    monster_hp = monster_hp - damage(3)'
          ),
          output(
            'Sparky says it is defeated',
            'Print a message when HP reaches 0.',
            'defeat|win|won|dead|hp\\D*\\b0\\b',
            { flags: 'i' }
          ),
        ],
        true,
        [
          order('Build the fight. Tap the lines.', [
            'monster_hp = 9',
            'while monster_hp > 0:',
            '    monster_hp = monster_hp - damage(3)',
            'print("Defeated!")',
          ]),
          bug(
            'Tap the broken line.',
            'monster_hp = 9\nwhile monster_hp > 0:\n    damage(3)',
            2,
            'Save the result in monster_hp.'
          ),
        ],
        'Hit the monster until HP is 0.'
      ),
      task(
        'heal',
        'choice',
        'make',
        'Heal spell',
        'heal adds to your HP.',
        'Help me write a heal spell.',
        [
          calls('heal(5, 3) gives 8', 'Return hp + amount.', 'heal(5, 3) == 8'),
          calls('heal(10, 5) gives 15', 'Use both parameters.', 'heal(10, 5) == 15'),
        ],
        false,
        [
          learn('A spell can have two slots.', [
            { code: 'def heal(hp, amount):', note: 'Two slots. Order matters.', hl: 'hp, amount' },
            { code: 'heal(5, 3)', note: 'hp is 5. amount is 3.' },
          ]),
          choose(
            'What will Sparky say?',
            ['15', '10', '5'],
            0,
            'hp is 10. amount is 5. 10 + 5 is 15.',
            'def heal(hp, amount):\n    return hp + amount\nprint(heal(10, 5))'
          ),
        ],
        'Write heal. It adds to HP.'
      ),
      task(
        'crit',
        'bonus',
        'make',
        'Critical hit',
        'A lucky roll gives a crit.',
        'Help me add a lucky crit.',
        [
          match(
            'A spell rolls the dice',
            'Put randint inside a def.',
            '^[ \\t]+[^#\\n]*random\\.randint\\(',
            '    chance = random.randint(1, 10)'
          ),
          match(
            'An if checks the roll',
            'Ask: is the roll above 8?',
            '^[ \\t]+if\\s+.+:',
            '    if chance > 8:'
          ),
          runs,
        ],
        false,
        [
          learn('A spell can roll dice.', [
            {
              code: 'chance = random.randint(1, 10)',
              note: 'A lucky roll: 1 to 10.',
              hl: 'randint',
            },
            { code: 'if chance > 8:', note: '9 or 10 is a crit.', hl: 'if' },
          ]),
          order('Build the spell. Tap the lines.', [
            'def hit():',
            '    chance = random.randint(1, 10)',
            '    if chance > 8:',
            '        return 10',
          ]),
        ],
        'Add a lucky crit to your spell.'
      ),
      task(
        'hw-shield',
        'bonus',
        'make',
        'Shield spell',
        'shield cuts damage in half.',
        'Help me write a shield spell.',
        [
          match(
            'You wrote shield',
            'Start with def shield(dmg):',
            '^\\s*def\\s+shield\\(',
            'def shield(dmg):'
          ),
          calls('shield(10) gives 5', 'Return half of dmg.', 'shield(10) == 5'),
        ]
      ),
      task(
        'hw-explain',
        'bonus',
        'explain',
        'Explain the code',
        'Each line has a # note.',
        'Help me explain each line.',
        [
          match(
            'You added 3 notes with #',
            'A # note goes after your code.',
            NOTE,
            'age = 10  # my age',
            3
          ),
        ]
      ),
      task(
        'hw-bug-return',
        'bonus',
        'bugzap',
        'Fix the spell',
        'bugzap.py prints 10.',
        'Help me find the mistake in bugzap.py.',
        [
          output('bugzap.py says 10', 'A spell needs return to give a number back.', '^10$', {
            flags: 'm',
            file: 'bugzap.py',
          }),
        ]
      ),
    ],
  },
  {
    id: 106,
    title: 'Week #6 — Bug Hunt',
    description: 'The Robot Factory is glitching. Find every bug and graduate.',
    templateFile: 'py/w6.py',
    starterFile: 'main.py',
    // One file on purpose: every bug lives in a function that a check calls on
    // its own, so a crash in one never hides the others.
    scene: 'robot',
    aiPolicy: 'tutor',
    badge: 'Code Agent',
    tasks: [
      task(
        'read-crash',
        'core',
        'bugzap',
        'Read the crash',
        'The battery report works.',
        'Help me read the red text.',
        [
          calls(
            'battery_report() works',
            'Read the last line of the red text.',
            '"battery" in str(battery_report()).lower()'
          ),
        ],
        false,
        [
          learn('Red text tells you what broke.', [
            { code: 'File "main.py", line 3', note: 'Where it broke: line 3.' },
            {
              code: "NameError: name 'battery' is not defined",
              note: 'What: battery was never made.',
              hl: 'battery',
            },
          ]),
          pairUp('Tap an error. Tap its meaning.', [
            ['NameError', 'Name not made yet'],
            ['TypeError', 'Wrong kind of value'],
            ['IndexError', 'Slot does not exist'],
          ]),
          bug(
            'Tap the broken line.',
            'def battery_report():\n    return "Battery: " + str(battery)',
            1,
            'battery is not made yet.'
          ),
        ],
        'Read the red text. Fix the crash.'
      ),
      task(
        'three-bugs',
        'core',
        'bugzap',
        'Three bugs',
        'Robots say 3. Power says 15.',
        'Help me find three bugs.',
        [
          calls('robot_count() says 3', 'Print it. Is the number too big?', 'robot_count() == 3'),
          calls(
            'total_power() says 15',
            'Check where the loop starts. Check the end.',
            'total_power() == 15'
          ),
        ],
        false,
        [
          bug(
            'Tap the broken line.',
            'robots = ["Sparky", "Bolt", "Gizmo"]\nprint(len(robots) + 1)',
            1,
            'Too big. Remove + 1.'
          ),
          choose(
            'What will Sparky say?',
            ['1 2', '1 2 3', '0 1 2'],
            0,
            'range(1, 3) stops before 3.',
            'for i in range(1, 3):\n    print(i)'
          ),
        ],
        'Robots say 3. Power says 15.'
      ),
      task(
        'detective',
        'core',
        'predict',
        'Output detective',
        'You guessed, then compared.',
        'Help me guess the output.',
        [guess()],
        false,
        [
          stage(
            'boxes',
            'Run the lines. Tap them in order.',
            { boxes: [{ name: 'x', value: 3 }, { name: 'y' }] },
            { values: { x: 7, y: 6 } },
            [
              ['y = x * 2', 'set:y=6'],
              ['x = y + 1', 'set:x=7'],
              ['x = 4', 'set:x=4'],
            ],
            [0, 1]
          ),
          choose(
            'What will Sparky say?',
            ['2', '5', '7'],
            0,
            'b copied 2. Later a changes. b stays.',
            'a = 2\nb = a\na = 5\nprint(b)'
          ),
        ],
        'Guess first. Then compare.'
      ),
      task(
        'catch-ai',
        'core',
        'bugzap',
        'Catch the AI',
        'average gives the right answer.',
        'Help me test the AI’s code.',
        [
          calls(
            'average(4, 8) gives 6',
            'Print it and compare. Check the brackets.',
            'average(4, 8) == 6'
          ),
          calls('average(10, 20) gives 15', 'Test another pair.', 'average(10, 20) == 15'),
        ],
        false,
        [
          learn('Test code. Do not just trust it.', [
            { code: '4 + 8 / 2', note: '/ goes first: 4 + 4.', hl: '/' },
            { code: '(4 + 8) / 2', note: 'Brackets first: 12 / 2.', hl: '(4 + 8)' },
          ]),
          bug(
            'Tap the broken line.',
            'def average(a, b):\n    return a + b / 2',
            1,
            'Use brackets around a + b.'
          ),
        ],
        'Test average. Fix it.'
      ),
      task(
        'factory-rescue',
        'core',
        'bugzap',
        'Boss: Factory rescue',
        'Every test passes.',
        'Help me rescue the factory.',
        [
          calls(
            'crew_power adds every power',
            'Add to total. Do not replace it.',
            'crew_power(crew) == 20'
          ),
          calls(
            'strongest finds Gizmo',
            'Is the comparison the right way round?',
            'strongest(crew) == "Gizmo"'
          ),
          calls(
            'robot_names gives the list back',
            'print shows a list. return gives it back.',
            'robot_names(crew) == ["Sparky", "Bolt", "Gizmo"]'
          ),
          calls('count_robots says 3', 'Count every robot.', 'count_robots(crew) == 3'),
        ],
        true,
        [
          order('Tap the steps in order.', [
            'Read the error',
            'Guess why',
            'Test with print',
            'Fix. Run again.',
          ]),
          bug(
            'Tap the broken line.',
            'def double(n):\n    print(n * 2)\nprint(double(4) + 1)',
            1,
            'print shows it. Use return.'
          ),
        ],
        'Fix every bug. Run the tests.'
      ),
      task(
        'shrink',
        'choice',
        'change',
        'Shrink the code',
        'One loop makes three beeps.',
        'Help me shrink my code.',
        [
          match(
            'A loop prints Beep',
            'Use for i in range(1, 4): then print.',
            '^\\s*for\\s+\\w+\\s+in\\s+range\\([^)]*\\):[ \\t]*\\n[ \\t]+print\\([^)\\n]*beep',
            'for i in range(1, 4):\n    print("Beep", i)',
            1,
            'mi'
          ),
        ],
        false,
        [
          learn('A loop replaces many lines.', [
            { code: 'print("Beep 1")', note: 'Three lines. One job.' },
            { code: 'for i in range(1, 4):', note: 'Runs 3 times.', hl: 'range' },
          ]),
          choose(
            'How many beeps?',
            ['3', '4', '1'],
            0,
            'range(1, 4) gives 1, 2, 3.',
            'for i in range(1, 4):\n    print("Beep")'
          ),
        ],
        'Make 3 beeps with one loop.'
      ),
      task(
        'plant-bug',
        'bonus',
        'make',
        'Plant a bug',
        'A friend can hunt your bug.',
        'Help me hide a bug.',
        [
          match(
            'You left a bug: note',
            'Write # bug: then where it is.',
            '^\\s*#[ \\t]*bug:[ \\t]*\\S',
            '# bug: line 3',
            1,
            'mi'
          ),
        ]
      ),
      task(
        'hw-bug-crash',
        'bonus',
        'bugzap',
        'Fix the crash',
        'greet says hello.',
        'Help me find the mistake in greet.',
        [
          calls(
            'greet("Sparky") works',
            'Read the last line of the red text.',
            '"Sparky" in str(greet("Sparky"))'
          ),
        ]
      ),
      task(
        'hw-report',
        'bonus',
        'explain',
        'Write a bug report',
        'Your report has three notes.',
        'Help me write a bug report.',
        [
          match(
            'You wrote the error',
            'Write # error: then the red text.',
            '^\\s*#[ \\t]*error:[ \\t]*\\S',
            '# error: NameError',
            1,
            'mi'
          ),
          match(
            'You wrote what you expected',
            'Write # expected: then what should happen.',
            '^\\s*#[ \\t]*expected:[ \\t]*\\S',
            '# expected: Hello',
            1,
            'mi'
          ),
          match(
            'You wrote what you got',
            'Write # got: then what really happened.',
            '^\\s*#[ \\t]*got:[ \\t]*\\S',
            '# got: a red error',
            1,
            'mi'
          ),
        ]
      ),
    ],
  },
  {
    id: 107,
    title: 'Week #7 — Monster Dex',
    description: 'Sparky keeps a Monster Dex. Grow it, count it, sort it.',
    templateFile: 'py/w7.py',
    starterFile: 'main.py',
    extraFiles: { 'bugzap.py': 'py/w7-bugzap.py' },
    scene: 'robot',
    aiPolicy: 'tutor',
    badge: 'Key Master',
    tasks: [
      task(
        'new-monster',
        'core',
        'change',
        'New monster',
        'The dex grows. The bat levels up.',
        'Help me add a monster to the dex.',
        [
          match(
            'You added a new monster',
            'A new name makes a new box: dex["imp"] = 3',
            `^\\s*dex\\[\\s*["'](?!(?:slime|bat|golem)["'])[^"'\\n]+["']\\s*\\]\\s*=(?!=)`,
            'dex["imp"] = 3'
          ),
          match(
            'The bat got 1 more power',
            'Use its old power: dex["bat"] + 1',
            `^\\s*dex\\[\\s*(["'])(\\w+)\\1\\s*\\]\\s*(?:\\+=|=\\s*dex\\[\\s*["']\\2["']\\s*\\]\\s*\\+)`,
            'dex["bat"] = dex["bat"] + 1'
          ),
          runs,
        ],
        false,
        [
          stage(
            'boxes',
            'Add the imp. Level up the bat.',
            {
              boxes: [
                { name: 'slime', value: 2 },
                { name: 'bat', value: 5 },
              ],
            },
            { values: { imp: 3, bat: 6 } },
            [
              ['dex["imp"] = 3', 'set:imp=3'],
              ['dex["bat"] = dex["bat"] + 1', 'add:bat:1'],
              ['dex["bat"] = 1', 'set:bat=1'],
            ],
            [0, 1]
          ),
          learn('A new name makes a new box.', [
            { code: 'dex["imp"] = 3', note: 'New name? New box.', hl: '"imp"' },
            { code: 'dex["bat"] = dex["bat"] + 1', note: 'Old name? Its box changes.', hl: '+ 1' },
          ]),
          choose(
            'How many monsters now?',
            ['2', '3', '1'],
            0,
            'bat was changed, not added. imp is new.',
            'dex = {"bat": 5}\ndex["imp"] = 3\ndex["bat"] = 6\nprint(len(dex))'
          ),
        ],
        'Add a new monster. Level up the bat.'
      ),
      task(
        'unknown-monster',
        'core',
        'change',
        'Unknown monster',
        'Sparky asks first. No crash.',
        'Help me look up a monster safely.',
        [
          match(
            'You asked about the yeti',
            'Ask first: "yeti" in dex, or dex.get("yeti", 0)',
            `^[^#\\n]*(?:["']yeti["']\\s+in\\s+dex\\b|\\bdex\\.get\\(\\s*["']yeti["'])`,
            'print(dex.get("yeti", 0))'
          ),
          runs,
        ],
        false,
        [
          bug(
            'Tap the line that crashes.',
            'dex = {"bat": 5}\nprint(dex["bat"])\nprint(dex["yeti"])',
            2,
            'No yeti in the dex. KeyError!'
          ),
          learn('Ask first. Then look.', [
            { code: 'if "yeti" in dex:', note: 'Ask first. True or False.', hl: 'in' },
            { code: 'dex.get("yeti", 0)', note: 'Not there? You get 0.', hl: 'get', speak: '0' },
          ]),
          pairUp('Tap a piece. Tap its job.', [
            ['dex["yeti"]', 'Crash if it is missing'],
            ['"yeti" in dex', 'True or False'],
            ['dex.get("yeti", 0)', '0 if it is missing'],
          ]),
        ],
        'Look up the yeti. Ask first so it does not crash.'
      ),
      task(
        'count-sightings',
        'core',
        'make',
        'Count sightings',
        'seen counts every monster.',
        'Help me count the monsters Sparky saw.',
        [
          match(
            'You loop over sightings',
            'Try: for name in sightings:',
            '^\\s*for\\s+\\w+\\s+in\\s+sightings\\s*:',
            'for name in sightings:'
          ),
          calls(
            'seen says bat 3 times',
            'Start at 0. Add 1 each time you see it.',
            'seen.get("bat") == 3'
          ),
          runs,
        ],
        false,
        [
          stage(
            'boxes',
            'Sparky saw bat, imp, bat. Count them.',
            { boxes: [] },
            { values: { bat: 2, imp: 1 } },
            [
              ['seen["bat"] = seen.get("bat", 0) + 1', 'add:bat:1'],
              ['seen["imp"] = seen.get("imp", 0) + 1', 'add:imp:1'],
              ['seen["bat"] = 1', 'set:bat=1'],
            ],
            [0, 1, 0]
          ),
          learn('Count in a loop.', [
            { code: 'for name in sightings:', note: 'One monster at a time.' },
            { code: 'seen[name] = seen.get(name, 0) + 1', note: 'Start at 0. Add 1.', hl: 'get' },
          ]),
          order('Tap the lines in order.', [
            'seen = {}',
            'for name in sightings:',
            '    seen[name] = seen.get(name, 0) + 1',
            'print(seen)',
          ]),
        ],
        'Count every sighting. Print seen.'
      ),
      task(
        'monster-types',
        'core',
        'make',
        'Monster types',
        'Each type lists its monsters.',
        'Help me sort monsters by type.',
        [
          match(
            'You added to a type list',
            'Pick the list first: types["fire"].append(...)',
            `^\\s*types\\[\\s*["']\\w+["']\\s*\\]\\.append\\(`,
            'types["fire"].append("drake")'
          ),
          calls(
            'Fire has two monsters',
            'Add "drake" to the fire list.',
            'len(types["fire"]) == 2'
          ),
          match(
            'You loop with .items()',
            'Try: for kind, names in types.items():',
            '^\\s*for\\s+\\w+\\s*,\\s*\\w+\\s+in\\s+types\\.items\\(\\s*\\)\\s*:',
            'for kind, names in types.items():'
          ),
          runs,
        ],
        false,
        [
          learn('A key can hold a list.', [
            { code: 'types = {"fire": ["imp"]}', note: 'fire holds a list.', hl: '["imp"]' },
            {
              code: 'types["fire"].append("drake")',
              note: 'Open the fire list. Add one.',
              hl: 'append',
            },
          ]),
          walk(
            'Step through the types.',
            'types = {"fire": ["imp"], "ice": []}\ntypes["fire"].append("bat")\ntypes["ice"].append("yak")\nprint(types["fire"])\nprint(types["ice"])',
            [
              { line: 1, vars: {}, note: 'Each type gets a list.' },
              {
                line: 2,
                vars: { types: "{'fire': ['imp'], 'ice': []}" },
                note: 'bat goes in the fire list.',
              },
              {
                line: 3,
                vars: { types: "{'fire': ['imp', 'bat'], 'ice': []}" },
                note: 'yak goes in the ice list.',
              },
              {
                line: 4,
                vars: { types: "{'fire': ['imp', 'bat'], 'ice': ['yak']}" },
                note: 'Print only the fire list.',
              },
              {
                line: 5,
                vars: { types: "{'fire': ['imp', 'bat'], 'ice': ['yak']}" },
                out: "['imp', 'bat']",
                note: 'Sparky said the fire list.',
              },
            ]
          ),
          bug(
            'Tap the broken line.',
            'types = {"fire": ["imp"]}\ntypes.append("drake")\nprint(types)',
            1,
            'Pick the list first: types["fire"].append'
          ),
        ],
        'Add drake to fire. Print each type and its monsters.'
      ),
      task(
        'dex-report',
        'core',
        'make',
        'Boss: Dex report',
        'Sparky says the top monster and total.',
        'Help me build the Dex report.',
        [
          calls(
            'tally counts ghost 4 times',
            'Count the log like seen.',
            'tally.get("ghost") == 4'
          ),
          match(
            'You loop over tally.items()',
            'Try: for name, n in tally.items():',
            '^\\s*for\\s+\\w+\\s*,\\s*\\w+\\s+in\\s+tally\\.items\\(\\s*\\)\\s*:',
            'for name, n in tally.items():'
          ),
          output(
            'Sparky names the most seen',
            'Keep the name with the biggest count.',
            '(?:most|top|best)\\D{0,20}ghost|ghost\\D{0,20}(?:most|top|best)',
            { flags: 'i' }
          ),
          output(
            'Sparky says the total 8',
            'Print the word total, then the number.',
            'total\\D{0,20}\\b8\\b',
            {
              flags: 'i',
            }
          ),
        ],
        true,
        [
          choose(
            'What will Sparky say?',
            ['slime', 'bat', '3'],
            0,
            'max looks at the names, not the counts.',
            'tally = {"bat": 3, "slime": 1}\nprint(max(tally))'
          ),
          bug(
            'Tap the broken line.',
            'top = 0\nfor name, n in tally.items():\n    if n < top:\n        top = n',
            2,
            'Bigger wins: use n > top.'
          ),
        ],
        'Count the log. Print the most seen monster and the total.'
      ),
      task(
        'release',
        'choice',
        'change',
        'Release a monster',
        'The slime goes home.',
        'Help me take a monster out.',
        [
          calls(
            'The slime is gone',
            'Try del dex["slime"] or dex.pop("slime")',
            '"slime" not in dex'
          ),
          runs,
        ],
        false,
        [
          learn('Take a monster out.', [
            { code: 'del dex["slime"]', note: 'The slime box is gone.', hl: 'del' },
            { code: 'dex.pop("slime")', note: 'Gone, and you get 2 back.', hl: 'pop', speak: '2' },
          ]),
          pairUp('Tap a piece. Tap its job.', [
            ['del dex["slime"]', 'The box is gone'],
            ['dex.pop("slime")', 'Gone, and gives back 2'],
            ['dex.remove("slime")', 'Crash: no remove for dicts'],
          ]),
        ],
        'Let the slime go. Print the dex.'
      ),
      task(
        'hw-my-dex',
        'bonus',
        'make',
        'My dex',
        'Your own dex has five monsters.',
        'Help me make my own dex.',
        [
          match(
            'Your dex has 5 monsters',
            'Put five name: power pairs inside { }.',
            '^\\s*\\w+\\s*=\\s*\\{(?:[^{}:,\\n]+:[^{}:,\\n]+,){4,}[^{}:,\\n]+:[^{}:,\\n]+\\}',
            'my_dex = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}'
          ),
          runs,
        ]
      ),
      task(
        'hw-explain-dex',
        'bonus',
        'explain',
        'Explain the dex',
        'Each print line has a # note.',
        'Help me explain each line.',
        [
          match(
            'You added 3 notes with #',
            'A # note goes after your code.',
            NOTE,
            'print(1)  # one',
            3
          ),
        ]
      ),
      task(
        'hw-bug-key',
        'bonus',
        'bugzap',
        'Fix the crash',
        'bugzap.py finishes.',
        'Help me find the mistake in bugzap.py.',
        [
          output('bugzap.py says done', 'Read the last line of the red text.', 'done', {
            flags: 'i',
            file: 'bugzap.py',
          }),
        ]
      ),
    ],
  },
]
