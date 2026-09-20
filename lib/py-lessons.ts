import type { Lesson, LessonTask } from './lessons'
import type { TaskCheck } from './task-checks'

// Version 3: the Python course. Ids start at 101: class_enabled_lessons still
// holds rows 1-6 from the retired web course, and those must never re-enable a
// Python week by accident.
//
// Weeks 1-6 the AI is a tutor (aiPolicy 'tutor'); weeks 7-12 the student
// directs it ('director'). Checks are about what the program does, not which
// exact words the student typed: they either match the source loosely or run
// the program (lib/python-checks.ts). Every printed line is something Sparky
// says on screen; `import sparky` adds colors, the vault door and the alarm.

const match = (label: string, hint: string, pattern: string, example: string, min = 1, flags = 'm'): TaskCheck => ({
  kind: 'sourceMatches', label, hint, pattern, flags, min, example,
})
const output = (label: string, hint: string, pattern: string, extra: { flags?: string; file?: string; inputs?: string[] } = {}): TaskCheck => ({
  kind: 'outputContains', label, hint, pattern, ...extra,
})
// Something that happened in Sparky's world: "say:…", "color:…", "door:open", "alarm".
const world = (label: string, hint: string, pattern: string): TaskCheck => ({
  kind: 'worldContains', label, hint, pattern, flags: 'm',
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
  kind: 'callReturns', label, hint, call, equals: 'True', ...(file ? { file } : {}),
})
const runs3 = output('It runs without errors', 'Press Run. Fix any red text.', '\\S', { inputs: IN })

// Predict tasks: the student writes their guess after "# guess:" before running.
const guess = (min = 1): TaskCheck =>
  match(
    min > 1 ? `You wrote ${min} guesses` : 'You wrote your guess',
    'Write your guess after # guess: first.',
    '^\\s*#[ \\t]*guess:[ \\t]*\\S',
    '# guess: 62',
    min,
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
): LessonTask {
  return { id, type, kind, chip, success, prompt, commentAnchor: `TASK: ${id}`, checks, ...(boss ? { boss } : {}) }
}

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
    homeworkBrief: 'Add facts and fix a crash.',
    tasks: [
      task('first-words', 'core', 'change', 'Make Sparky talk', 'Sparky says your words.',
        'Help me change what Sparky says.', [
          // Any line except the starter's own, whatever the quote marks.
          output('Sparky says new words', 'Change the words inside the quotes.', '^(?!beep boop\\s*$)\\S.*$', { flags: 'm' }),
        ]),
      task('name-tag', 'core', 'make', 'Save your name', 'Sparky greets you by name.',
        'Help me store my name in a variable.', [
          match('You made a name variable', 'Write name = then your name in quotes.', '^\\s*name\\s*=\\s*["\'].+["\']', 'name = "Ada"'),
          match('You greet with an f-string', 'Put a letter f before the quotes.', `${PRINT_LINE}\\s*f["'][^"'\\n]*\\{name\\}`, 'print(f"Hi {name}")'),
          runs,
        ]),
      task('shout', 'core', 'change', 'Make it LOUD', 'Sparky says something in capitals.',
        'Help me make Sparky shout.', [
          match('You changed the letters', 'A string can change its own letters.', '\\.upper\\(\\)|\\*\\s*\\d', 'print(name.upper())'),
          output('Sparky shouts', 'Sparky must say capital letters.', '[A-Z]{2,}', { flags: '' }),
        ]),
      task('boot-up', 'core', 'make', 'Boss: Boot-up screen', 'Sparky’s screen is ready.',
        'Help me build my boot-up screen.', [
          match('You made 4 variables', 'Save four facts about you.', ASSIGN, 'age = 10', 4, 'mi'),
          match('4 lines use f-strings', 'Say each fact with an f-string.', PRINT_F, 'print(f"Hi {name}")', 4),
          match('You added 2 notes with #', 'A # note goes after your code.', NOTE, 'age = 10  # my age', 2),
          runs,
        ], true),
      task('paint', 'choice', 'make', 'Paint Sparky', 'Sparky has a new color.',
        'Help me change Sparky’s color.', [
          match('You imported sparky', 'Bring in Sparky’s tools first.', '^\\s*import\\s+sparky', 'import sparky'),
          match('You called sparky.color', 'Give sparky.color a color name.', '^\\s*sparky\\.color\\(', 'sparky.color("pink")'),
          world('Sparky changes color', 'Press Run and watch Sparky.', '^color:'),
        ]),
      task('story', 'bonus', 'make', 'Tell a long story', 'Sparky tells a story on many lines.',
        'Help me print a long story.', [
          match('You used triple quotes', 'Three quotes hold many lines.', `${PRINT_LINE}\\s*(?:"""|''')`, 'print("""Hi\nthere""")'),
        ]),
      task('hw-add-fact', 'homework', 'make', 'Add 2 more facts', 'Sparky shares two more facts.',
        'Help me add two more facts.', [
          match('You have 6 variables', 'Save two more facts in variables.', ASSIGN, 'age = 10', 6, 'mi'),
          match('6 lines use f-strings', 'Say each new fact with an f-string.', PRINT_F, 'print(f"Hi {name}")', 6),
        ]),
      task('hw-bug-quote', 'homework', 'bugzap', 'Fix the crash', 'bugzap.py runs.',
        'Help me find the mistake in bugzap.py.', [
          output('bugzap.py says ready', 'Read the last line of the red text.', 'ready', { flags: 'i', file: 'bugzap.py' }),
        ]),
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
    homeworkBrief: 'Give a discount and fix the door.',
    tasks: [
      task('vault-math', 'core', 'predict', 'Do vault math', 'Sparky says new math answers.',
        'Help me guess what Sparky says.', [
          guess(),
          match('You multiplied', 'Use the star: *', `${PRINT_LINE}.*\\w\\s*\\*\\s*\\w`, 'print(price * 3)'),
          match('You used // or %', 'Try the two division tricks.', `${PRINT_LINE}.*(?://|%)`, 'print(coins % price)'),
        ]),
      task('true-false', 'core', 'predict', 'True or False?', 'Sparky says True and False.',
        'Help me guess True or False.', [
          guess(2),
          match('You compared two things', 'Print a question with > or ==.', `${PRINT_LINE}.*(?:==|!=|<=|>=|<|>)`, 'print(coins > price)'),
          output('Sparky says True', 'Ask a question with answer True.', '^True$', { flags: 'm' }),
          output('Sparky says False', 'Ask a question with answer False.', '^False$', { flags: 'm' }),
        ]),
      task('door-lock', 'core', 'make', 'Lock the door', 'The door opens for the right code.',
        'Help me lock the door with an if.', [
          match('You wrote an if rule', 'Ask: does guess equal secret?', '^\\s*if\\s+.+:\\s*$', 'if guess == secret:'),
          match('You wrote an else rule', 'else covers every other code.', '^\\s*else\\s*:', 'else:'),
          world('The door moves', 'Use a door tool inside your rule.', '^door:'),
          runs,
        ]),
      task('three-doors', 'core', 'make', 'Add a warm door', 'Sparky has three outcomes.',
        'Help me add a third door with elif.', [
          match('You wrote an elif rule', 'elif goes between if and else.', '^\\s*elif\\s+.+:\\s*$', 'elif guess > 1000:'),
          runs,
        ]),
      task('vault-guard', 'core', 'make', 'Boss: Vault guard', 'Open, closed, or alarm.',
        'Help me build the vault guard.', [
          match('A rule uses < or >', 'Is the guess bigger or smaller?', '^\\s*(?:el)?if\\s.*[<>]', 'elif guess > secret:'),
          match('You sound the alarm', 'Use the alarm tool for wrong codes.', '^\\s*sparky\\.alarm\\(', 'sparky.alarm()'),
          match('Every door does something', 'Each door needs its own action.', '^[ \\t]+(?:print|sparky\\.\\w+)\\(', '    print("Door open!")', 3),
          runs,
        ], true),
      task('and-or', 'choice', 'change', 'Try and / or', 'A rule uses and, or or.',
        'Help me use and or or in a rule.', [
          match('A rule uses and or or', 'Join two questions in one if.', '^\\s*(?:el)?if\\s.*\\b(?:and|or)\\b.*:', 'if guess > 0 and guess < 9999:'),
        ]),
      task('even-odd', 'bonus', 'make', 'Even or odd?', 'Sparky tells even from odd.',
        'Help me find even and odd numbers.', [
          match('You used % 2', 'An even number has no rest.', '%\\s*2\\s*==', 'if coins % 2 == 0:'),
          match('Sparky says even or odd', 'Print "even" or "odd".', `${PRINT_LINE}.*(?:even|odd)`, 'print("even")', 1, 'mi'),
        ]),
      task('hw-discount', 'homework', 'make', 'Shop discount', 'Big totals get a discount.',
        'Help me give a discount on big totals.', [
          match('You check the total', 'Ask: is the total over 50?', '^\\s*(?:el)?if\\s+total\\s*[<>]', 'if total > 50:'),
          output('Sparky says the new total', 'Take 10 off, or 10 percent.', '\\b(?:70|72)(?:\\.0)?\\b'),
        ]),
      task('hw-bug-equals', 'homework', 'bugzap', 'Fix the door', 'bugzap.py opens the door.',
        'Help me find the mistake in bugzap.py.', [
          output('bugzap.py opens the door', 'Read the last line of the red text.', 'open', { flags: 'i', file: 'bugzap.py' }),
        ]),
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
    homeworkBrief: 'Launch countdown, explain a loop, fix a crash.',
    tasks: [
      task('count-down', 'core', 'predict', 'Count with a loop', 'Sparky counts up to 3.',
        'Help me guess what the loop prints.', [
          guess(),
          output('Sparky counts to 3', 'Change the number inside range().', '^3$', { flags: 'm', inputs: IN }),
        ]),
      task('times-table', 'core', 'change', 'Count by twos', 'Sparky counts in steps.',
        'Help me count with a step.', [
          match('You gave range a step', 'range(start, stop, step) takes three numbers.', RANGE_STEP, 'for n in range(2, 12, 2):'),
          runs3,
        ]),
      task('hold-line', 'core', 'make', 'Hold the line', 'A while loop stops with break.',
        'Help me stop a while loop.', [
          match('You wrote a while loop', 'Write while, a question, then a colon.', WHILE, 'while count < 3:'),
          match('You used break', 'break ends the loop early.', '^\\s+break\\b', '    break'),
          match('Your counter goes up', 'Add 1 to your counter each time.', '^\\s*(\\w+)\\s*(?:\\+=|-=|=\\s*\\1\\s*[+-])', 'count += 1'),
          runs3,
        ]),
      task('ask-repeat', 'core', 'make', 'Ask and repeat', 'Sparky repeats as you ask.',
        'Help me ask for a number and repeat.', [
          match('You used input()', 'Turn the answer into a number with int().', ASK, 'times = int(input("How many? "))'),
          match('A loop uses your number', 'Put your number inside range().', '^\\s*for\\s+\\w+\\s+in\\s+range\\(\\s*(?:[A-Za-z_]\\w*|int\\(\\s*input)', 'for i in range(times):'),
          runs3,
        ]),
      task('guess-number', 'core', 'make', 'Boss: Guess the number', 'Sparky says higher or lower.',
        'Help me build the guess game.', [
          match('You wrote a while loop', 'Repeat until the guess is right.', WHILE, 'while True:'),
          match('You ask for a guess', 'Use int(input()) inside the loop.', ASK, 'guess = int(input("Guess: "))'),
          output('Sparky says higher', 'Keep secret = 7 so Sparky can test.', 'higher', { flags: 'i', inputs: IN }),
          output('Sparky says lower', 'A guess over 7 needs Lower.', 'lower', { flags: 'i', inputs: IN }),
        ], true),
      task('stars', 'choice', 'make', 'Star triangle', 'Sparky draws stars.',
        'Help me print a star triangle.', [
          match('You multiplied a star', 'Try "*" * 3 inside print.', '^\\s*print\\(\\s*["\']\\*["\']\\s*\\*', 'print("*" * i)'),
          output('Stars are on screen', 'Press Run and look for **.', '^\\*{2,}$', { flags: 'm', inputs: IN }),
        ]),
      task('total', 'bonus', 'make', 'Add up 1 to 100', 'Sparky says the total.',
        'Help me add up 1 to 100.', [
          output('Sparky says 5050', 'Add each number to a total.', '\\b5050\\b', { inputs: IN }),
        ]),
      task('hw-countdown', 'homework', 'make', 'Launch countdown', 'Sparky counts down, then launches.',
        'Help me count down and launch.', [
          match('You counted down', 'Use range with a step of -1.', 'range\\([^)]*,\\s*-\\d+\\s*\\)', 'for n in range(5, 0, -1):'),
          output('Sparky says launch', 'Print a launch message at the end.', 'launch|liftoff|blast', { flags: 'i', inputs: IN }),
        ]),
      task('hw-explain', 'homework', 'explain', 'Explain the loop', 'Each line has a # note.',
        'Help me explain the loop lines.', [
          match('You added 2 notes with #', 'A # note goes after your code.', NOTE, 'age = 10  # my age', 2),
        ]),
      task('hw-bug-loop', 'homework', 'bugzap', 'Fix the countdown', 'bugzap.py counts down.',
        'Help me find the mistakes in bugzap.py.', [
          output('bugzap.py says Liftoff', 'Read the last line of the red text.', 'liftoff', { flags: 'i', file: 'bugzap.py' }),
        ]),
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
    homeworkBrief: 'Shopping list, comments, and an index crash.',
    tasks: [
      task('backpack', 'core', 'predict', 'Open the backpack', 'Sparky shows the last item.',
        'Help me guess what the list prints.', [
          guess(),
          output('Sparky shows torch', 'Print the last item. Try backpack[-1].', '^torch$', { flags: 'm' }),
        ]),
      task('loot-loop', 'core', 'make', 'Loot loop', 'Sparky shows every item.',
        'Help me loop over my backpack.', [
          match('You looped over your list', 'Write for item in backpack:', FOR_IN, 'for item in backpack:'),
          match('The loop prints each item', 'Indent a print under the for line.', '^[ \\t]+print\\(', '    print(item)'),
          runs,
        ]),
      task('grab-drop', 'core', 'make', 'Grab and drop', 'Items go in and out.',
        'Help me add and remove items.', [
          match('You added with append', 'Try backpack.append("potion")', '^\\s*\\w+\\.append\\(', 'backpack.append("potion")'),
          match('You dropped with remove', 'Try backpack.remove("map")', '^\\s*\\w+\\.remove\\(', 'backpack.remove("map")'),
          match('You checked with in', 'Ask first: if "map" in backpack:', '^\\s*if\\s+.*\\bin\\b', 'if "map" in backpack:'),
          runs,
        ]),
      task('item-stats', 'core', 'make', 'Item stats', 'Each item has a power.',
        'Help me store powers in a dict.', [
          match('You looped with .items()', 'Write for name, power in stats.items():', '^\\s*for\\s+\\w+\\s*,\\s*\\w+\\s+in\\s+\\w+\\.items\\(\\)\\s*:', 'for name, power in stats.items():'),
          runs,
        ]),
      task('loot-report', 'core', 'make', 'Boss: Loot report', 'Sparky reports total, best, count.',
        'Help me build the loot report.', [
          output('Sparky says total power 12', 'Add up every power in loot.', '\\b12\\b'),
          output('Sparky names the best item', 'Print the item with the top power.', '(?:best|top|strong\\w*)\\D*sword|sword\\D*(?:best|top|strong\\w*)', { flags: 'i' }),
          match('You counted the items', 'len() counts what is in loot.', '\\blen\\(\\s*\\w+\\s*\\)', 'print(len(loot))', 2),
        ], true),
      task('sort-loot', 'choice', 'make', 'Sort the loot', 'The loot is in ABC order.',
        'Help me sort my loot.', [
          match('You sorted the loot', 'Try print(sorted(backpack))', '^[^#\\n]*\\bsorted\\(|^\\s*\\w+\\.sort\\(', 'print(sorted(backpack))'),
        ]),
      task('trade', 'bonus', 'make', 'Trade an item', 'Sparky trades one item away.',
        'Help me trade an item.', [
          match('You used pop()', 'pop() takes the last item out.', '\\.pop\\(', 'traded = backpack.pop()'),
          runs,
        ]),
      task('hw-shopping', 'homework', 'make', 'Shopping list', 'A list of five things.',
        'Help me make a shopping list.', [
          match('Your list has 5 things', 'Put five things inside [ ].', '^\\s*\\w+\\s*=\\s*\\[(?:[^\\[\\],]+,){4,}[^\\[\\],]+\\]', 'shopping = ["a", "b", "c", "d", "e"]'),
          runs,
        ]),
      task('hw-comment', 'homework', 'explain', 'Explain the prices', 'Each line has a # note.',
        'Help me explain each line.', [
          match('You added 3 notes with #', 'A # note goes after your code.', NOTE, 'age = 10  # my age', 3),
        ]),
      task('hw-bug-index', 'homework', 'bugzap', 'Fix the crash', 'bugzap.py finishes.',
        'Help me find the mistake in bugzap.py.', [
          output('bugzap.py says done', 'Read the last line of the red text.', 'done', { flags: 'i', file: 'bugzap.py' }),
        ]),
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
    homeworkBrief: 'Shield spell, notes, and a missing return.',
    tasks: [
      task('first-spell', 'core', 'make', 'Your first spell', 'Sparky casts your spell.',
        'Help me write my first spell.', [
          match('You wrote a spell with def', 'Write def cast(): then indent the body.', '^\\s*def\\s+\\w+\\(\\s*\\)\\s*:', 'def cast():'),
          match('You cast the spell', 'Call it by its name: cast()', '^(?!print\\b)[a-z_]\\w*\\(\\s*\\)\\s*$', 'cast()'),
          runs,
        ]),
      task('target-spell', 'core', 'make', 'Spell with a target', 'The spell knows its target.',
        'Help me give my spell a target.', [
          match('Your spell has a parameter', 'Put a name inside the ( ).', '^\\s*def\\s+\\w+\\(\\s*\\w+', 'def zap(target):'),
          match('You cast it with a target', 'Call it like zap("Ghost").', '^(?!print\\b)[a-z_]\\w*\\(\\s*(?:["\']|\\w)', 'zap("Ghost")'),
          runs,
        ]),
      task('damage', 'core', 'make', 'Damage spell', 'The spell returns a number.',
        'Help me return a number from a spell.', [
          match('You used return', 'return sends a value back.', '^\\s+return\\s+\\S', '    return power * 2'),
          calls('damage(5) gives 10', 'Return power * 2.', 'damage(5) == 10'),
        ]),
      task('dice', 'core', 'make', 'Roll the dice', 'Sparky rolls a number.',
        'Help me roll a dice.', [
          match('You imported random', 'Start with import random.', '^\\s*import\\s+random', 'import random'),
          match('You rolled with randint', 'Try random.randint(1, 6).', '^[^#\\n]*random\\.randint\\(', 'roll = random.randint(1, 6)'),
          runs,
        ]),
      task('battle-round', 'core', 'make', 'Boss: Battle round', 'You beat the monster.',
        'Help me build the battle round.', [
          match('You wrote a while loop', 'Keep hitting while HP is above 0.', WHILE, 'while monster_hp > 0:'),
          match('The loop uses damage()', 'Call damage() inside the loop.', '^[ \\t]+[^#\\n]*\\bdamage\\(', '    monster_hp = monster_hp - damage(3)'),
          output('Sparky says it is defeated', 'Print a message when HP reaches 0.', 'defeat|win|won|dead|hp\\D*\\b0\\b', { flags: 'i' }),
        ], true),
      task('heal', 'choice', 'make', 'Heal spell', 'heal adds to your HP.',
        'Help me write a heal spell.', [
          calls('heal(5, 3) gives 8', 'Return hp + amount.', 'heal(5, 3) == 8'),
          calls('heal(10, 5) gives 15', 'Use both parameters.', 'heal(10, 5) == 15'),
        ]),
      task('crit', 'bonus', 'make', 'Critical hit', 'A lucky roll gives a crit.',
        'Help me add a lucky crit.', [
          match('A spell rolls the dice', 'Put randint inside a def.', '^[ \\t]+[^#\\n]*random\\.randint\\(', '    chance = random.randint(1, 10)'),
          match('An if checks the roll', 'Ask: is the roll above 8?', '^[ \\t]+if\\s+.+:', '    if chance > 8:'),
          runs,
        ]),
      task('hw-shield', 'homework', 'make', 'Shield spell', 'shield cuts damage in half.',
        'Help me write a shield spell.', [
          match('You wrote shield', 'Start with def shield(dmg):', '^\\s*def\\s+shield\\(', 'def shield(dmg):'),
          calls('shield(10) gives 5', 'Return half of dmg.', 'shield(10) == 5'),
        ]),
      task('hw-explain', 'homework', 'explain', 'Explain the code', 'Each line has a # note.',
        'Help me explain each line.', [
          match('You added 3 notes with #', 'A # note goes after your code.', NOTE, 'age = 10  # my age', 3),
        ]),
      task('hw-bug-return', 'homework', 'bugzap', 'Fix the spell', 'bugzap.py prints 10.',
        'Help me find the mistake in bugzap.py.', [
          output('bugzap.py says 10', 'A spell needs return to give a number back.', '^10$', { flags: 'm', file: 'bugzap.py' }),
        ]),
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
    homeworkBrief: 'Fix a crash and write a bug report.',
    tasks: [
      task('read-crash', 'core', 'bugzap', 'Read the crash', 'The battery report works.',
        'Help me read the red text.', [
          calls('battery_report() works', 'Read the last line of the red text.', '"battery" in str(battery_report()).lower()'),
        ]),
      task('three-bugs', 'core', 'bugzap', 'Three bugs', 'Robots say 3. Power says 15.',
        'Help me find three bugs.', [
          calls('robot_count() says 3', 'Print it. Is the number too big?', 'robot_count() == 3'),
          calls('total_power() says 15', 'Check where the loop starts. Check the end.', 'total_power() == 15'),
        ]),
      task('detective', 'core', 'predict', 'Output detective', 'You guessed, then compared.',
        'Help me guess the output.', [
          guess(),
        ]),
      task('catch-ai', 'core', 'bugzap', 'Catch the AI', 'average gives the right answer.',
        'Help me test the AI’s code.', [
          calls('average(4, 8) gives 6', 'Print it and compare. Check the brackets.', 'average(4, 8) == 6'),
          calls('average(10, 20) gives 15', 'Test another pair.', 'average(10, 20) == 15'),
        ]),
      task('factory-rescue', 'core', 'bugzap', 'Boss: Factory rescue', 'Every test passes.',
        'Help me rescue the factory.', [
          calls('crew_power adds every power', 'Add to total. Do not replace it.', 'crew_power(crew) == 20'),
          calls('strongest finds Gizmo', 'Is the comparison the right way round?', 'strongest(crew) == "Gizmo"'),
          calls('robot_names gives the list back', 'print shows a list. return gives it back.', 'robot_names(crew) == ["Sparky", "Bolt", "Gizmo"]'),
          calls('count_robots says 3', 'Count every robot.', 'count_robots(crew) == 3'),
        ], true),
      task('shrink', 'choice', 'change', 'Shrink the code', 'One loop makes three beeps.',
        'Help me shrink my code.', [
          match('A loop prints Beep', 'Use for i in range(1, 4): then print.', '^\\s*for\\s+\\w+\\s+in\\s+range\\([^)]*\\):[ \\t]*\\n[ \\t]+print\\([^)\\n]*beep', 'for i in range(1, 4):\n    print("Beep", i)', 1, 'mi'),
        ]),
      task('plant-bug', 'bonus', 'make', 'Plant a bug', 'A friend can hunt your bug.',
        'Help me hide a bug.', [
          match('You left a bug: note', 'Write # bug: then where it is.', '^\\s*#[ \\t]*bug:[ \\t]*\\S', '# bug: line 3', 1, 'mi'),
        ]),
      task('hw-bug-crash', 'homework', 'bugzap', 'Fix the crash', 'greet says hello.',
        'Help me find the mistake in greet.', [
          calls('greet("Sparky") works', 'Read the last line of the red text.', '"Sparky" in str(greet("Sparky"))'),
        ]),
      task('hw-report', 'homework', 'explain', 'Write a bug report', 'Your report has three notes.',
        'Help me write a bug report.', [
          match('You wrote the error', 'Write # error: then the red text.', '^\\s*#[ \\t]*error:[ \\t]*\\S', '# error: NameError', 1, 'mi'),
          match('You wrote what you expected', 'Write # expected: then what should happen.', '^\\s*#[ \\t]*expected:[ \\t]*\\S', '# expected: Hello', 1, 'mi'),
          match('You wrote what you got', 'Write # got: then what really happened.', '^\\s*#[ \\t]*got:[ \\t]*\\S', '# got: a red error', 1, 'mi'),
        ]),
    ],
  },
]
