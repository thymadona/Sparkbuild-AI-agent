# Week 9 — Rex's Tricks: step sketch

**Approved by the owner (2026-09-24).** Plan group 1. Groups 2 and 4 build exactly this.

Lesson 109, `Week #9 — Rex's Tricks`, `aiPolicy: 'director'`, badge **Bug Spotter**. Every task
is its own program (`own: { starter }`), except `hw-bug-rex` in `bugzap.py`.

## Rules for the whole week

- **Idea of the week:** code that runs can still be wrong. Know what it should do, test it (at
  the border, at 0, against your ask), then say what you found.
- **The `# bug:` line** says what the code did against what it should do:
  `# bug: at 10 Rex waited, he should eat`. With no bug: `# bug: none, 9 and 10 work`. It needs 3+
  words, so a bare `none` fails. This is a new meaning: Week 6's `plant-bug` used `# bug:` for
  _where_ a bug is. Task 1's `learn` step shows the new form.
- **Where the rule lives:** starters have no comments. Each task's rule is in its `go` line (a
  text node that stays on the page), its `success` line and its labels. Labels state the rule in
  plain words and never name the fix (`>=`, `range(1, n + 1)`, the line).
- **Steps never show the starter's code.** They use other names and values (coins, spins, toys,
  walks), so they teach the idea and the student still finds the bug.
- **Checks:**
  - Functions plus `calls()` wherever possible. A `calls` check fails if the call raises (a
    renamed or deleted function). An `output` check fails on a crash. Test prints can go
    anywhere without breaking a check.
  - The "bug is gone" test and its positive partner share one `calls` expression (joined with
    `and`), so one check does both and costs one label.
- **Evidence on every task:** the behaviour checks, `notes(1, 'Add # and your words.')` and the new
  bug check, called `bugNote(min)` here. Group 2 settles its name, which must not clash with the
  `bug` step builder. Its label is `You wrote # bug:` and its hint `Say what it did wrong.` With
  `min = 2`: `You wrote 2 # bug: lines` / `One per mistake.`
- **Tutor-only `prompt`:** one terse line per task: "Scripted Bolt code under review", the rule,
  and what the planted bug _does_ (not the code fix). `taskList` puts all nine in every turn.
- No `input()`, and no starter comment except the `hw-bug-rex` anchor. `>=` is new (weeks 1–8
  never use it), and task 1 teaches it before the editor.

## Anti-repetition and the two big lessons

| #   | Task                  | Step types, in order | Taught here                                  |
| --- | --------------------- | -------------------- | -------------------------------------------- |
| 0   | w8 `hw-better-ask`    | bug                  | (week 8's last task with steps)              |
| 1   | `feed-rex`            | choose → learn       | **test before you trust**, `>=`, `# bug:`    |
| 2   | `trick-count`         | walk → match         | count the output, `range` stops early        |
| 3   | `empty-bowl`          | choose → order       | test 0, the missing case goes last           |
| 4   | `just-asked`          | stage (room)         | do only what was asked                       |
| 5   | `rex-check` (boss)    | match → walk         | plan the tests first (expected answers)      |
| 6   | `ask-and-check`       | learn                | the whole loop; **review can end in "none"** |
| 7   | `hw-rex-diary`        | stage (boxes)        | the right box                                |
| 8   | `hw-bolt-right`       | choose               | **review can end in no bug**, with proof     |
| 9   | `hw-bug-rex` (bugzap) | no steps, no `go`    | read the red text (Week 6 skill)             |

No type repeats between neighbouring tasks. `choose` appears three times, never in neighbouring
tasks. There is no `bug` step. Its node always says "Tap the line with the mistake", and this
week's steps have no mistake line to tap that the editor task doesn't also have.

## Difficulty ramp

1. The starter already prints the wrong case: run it and compare with the rule.
2. The wrong answer shows on the first run, but only if the student counts.
3. The starter's prints look right: the student must add a test (0) to see it.
4. The output looks fine at a glance: the student must read each line against the ask.
5. Boss: the prints look right and two mistakes hide. Plan tests, then find both.
6. The real Bolt: no planted bug. Test whatever it wrote.
7. Bonus: the output shows it, if you read it.
8. Bonus: nothing is wrong. Test anyway, then say "none" with proof.
9. Bonus: a crash, the week's only one. Read the red text.

## Reading load (`lesson-copy.test.ts` totals)

The test caps two totals over all lessons, and weeks 1–8 have almost filled both:

| Total                               | Now (weeks 1–8) | Cap with week 9 | Room for week 9 | This sketch |
| ----------------------------------- | --------------- | --------------- | --------------- | ----------- |
| Task copy (chip, success, checks)   | 2391            | < 2700          | 308             | **373**     |
| Step copy (prompts, options, `go`…) | 2239            | < 2520          | 280             | 277         |

- The step copy fits after trimming.
- The task copy doesn't. Most of it is the evidence checks every director task repeats: the
  notes check and the `# bug:` check add about 18 words per task, 9 times. Week 8 alone is 374.
- Decided (option A, group 2): the lesson total counts a label or hint that repeats inside a
  lesson once. Week 9's task copy drops to about 250. Each string keeps its own cap.

---

## 1. `feed-rex` · Feed Rex · core · kind `bugzap`

**One idea:** code that runs is not always right: test the border. **Misconception:** "No red
text, so it works."

Starter (Bolt's code):

```python
def feed(biscuits):
    if biscuits > 10:
        return "Rex eats"
    return "Rex waits"

print(feed(12))
print(feed(10))
```

Planted bug: `>` where `>=` is meant, so `feed(10)` says `Rex waits`. Fix: `biscuits >= 10`.

- `success`: `Rex eats with 10 or more biscuits.`
- `go`: `Bolt wrote this. Rex eats with 10 or more. Test it.`
- Steps:
  1. `choose` (hook, predict): "A ball costs 5 coins. What prints?". Code:
     `coins = 5 / if coins > 5: print("Buy") / else: print("Wait")`. Options `Buy`, `Wait`,
     `A red error`, answer `Wait`, explain `5 > 5 is False: 5 is not more.` The student
     understands the border because they predict it wrong first.
  2. `learn` "Test before you trust.", in 4 frames:
     - `coins = 9`: Buy. Looks right.
     - `coins = 5`: Wait! Test the border.
     - `if coins >= 5:` (hl `>=`): >= means 5 or more.
     - `# bug: at 5 it said Wait, not Buy`: Say what it did wrong.

     They understand `>=` and the `# bug:` form because they watch a test catch a bug.
- Checks:
  - `calls('Rex eats from 10 biscuits', 'Is 10 enough? Test it.', 'feed(10) == "Rex eats" and feed(9) == "Rex waits"')`.
    "Always eat" fails it.
  - `notes()`, `bugNote()`.
- `prompt`:
  `Scripted Bolt code under review. Rule: 10 or more biscuits, Rex eats. Planted bug: feed(10) says Rex waits.`

## 2. `trick-count` · Count the tricks · core · `bugzap`

**One idea:** count what comes out. `range(1, n)` stops before `n`. **Misconception:** "range(1, 3)
gives 1, 2, 3."

```python
def tricks(n):
    done = []
    for i in range(1, n):
        done.append("jump")
    return done

print(tricks(3))
```

Planted bug: off by one, so `tricks(3)` gives 2 jumps. Fix: `range(n)` or `range(1, n + 1)`.

- `success`: `tricks(3) gives 3 jumps.`
- `go`: `Bolt wrote this. tricks(3) must give 3 jumps.`
- Steps:
  1. `walk` "Step through. Count the spins." on `for i in range(1, 3): print("spin", i)`, in 5
     frames: Start at 1. → (i = 1) → One spin. → (i = 2) → Stops before 3! The student
     understands the early stop because they see `i` never reach 3.
  2. `match` "Tap a range. Tap its numbers.": `range(3)` ↔ `0 1 2`, `range(1, 3)` ↔ `1 2`,
     `range(1, 4)` ↔ `1 2 3`.
- Checks:
  - `calls('tricks gives the right count', 'Count the jumps.', 'tricks(3) == ["jump"] * 3 and len(tricks(5)) == 5')`.
    A hard-coded list fails it.
  - `notes()`, `bugNote()`.
- `prompt`:
  `Scripted Bolt code under review. tricks(n) must return n jumps. Planted bug: it returns one too few.`

## 3. `empty-bowl` · The empty bowl · core · `bugzap`

**One idea:** test the empty case. **Misconception:** "If it works for normal numbers, it works for
all numbers."

```python
def bowl(biscuits):
    if biscuits > 5:
        return "full"
    if biscuits > 0:
        return "some"

print(bowl(8))
print(bowl(3))
```

Planted bug: 0 is missed, so `bowl(0)` gives `None`. Fix: a last `return "empty"`.

- `success`: `The bowl says full, some or empty.`
- `go`: `Bolt wrote this. Over 5: full. 1–5: some. 0: empty.`
- Steps:
  1. `choose` "What does mood(0) give?". Code:
     `def mood(toys): / if toys > 0: return "happy" / print(mood(0))`. Options `happy`, `None`,
     `A red error`, answer `None`, explain `Nothing answers 0, so you get None.` The student
     understands the missing case because they predict an answer that never comes.
  2. `order` "Add the missing case. Tap in order.": `    if toys > 0:`, `        return "happy"`,
     `    return "sad"`. They understand the fallback goes last because any other order always
     says sad.
- Checks:
  - `calls('Every bowl gets an answer', 'Test the smallest bowl too.', 'bowl(0) == "empty" and bowl(8) == "full" and bowl(3) == "some"')`.
    A `return "empty"` at the top fails it.
  - `notes()`, `bugNote()`.
- `prompt`:
  `Scripted Bolt code under review. Rule: over 5 full, 1 to 5 some, 0 empty. Planted bug: bowl(0) returns None.`

## 4. `just-asked` · Just what I asked · core · kind `change`

**One idea:** check each line against your ask, because extra code is a mistake too.
**Misconception:** "More code is better. Bolt added a bonus."

```python
def visit(friends, snacks):
    for friend in friends:
        print("Hi " + friend)
        snacks = snacks - 1
    return snacks

left = visit(["Mia", "Sam"], 5)
print("Rex has", left, "snacks")
```

Planted bug: Bolt added "give each friend a snack", which nobody asked for, so Rex ends with 3.
Fix: delete `snacks = snacks - 1`.

- `success`: `Rex does just what you asked.`
- `go`: `You asked: hi to each friend, then count snacks. Check it.`
- Steps:
  1. `stage` room "Make Rex say only: Hi Ann, Hi Tom.". Blocks: `say Hi Ann`, `say Woof!`,
     `say Hi Tom`, solution `[0, 2]`. The student understands "only the ask" because the extra
     block loses the goal.
- Checks:
  - `output('Rex greets Mia and Sam', 'Both friends get a hi.', 'Hi Mia\\nHi Sam')`. Deleting
    the loop fails it.
  - `calls('Rex keeps his snacks', 'Did you ask for that?', 'visit(["Ann", "Tom"], 4) == 4')`.
    Changing `5` to `7` in the program doesn't fool it.
  - `notes()`, `bugNote()`.
- `prompt`:
  `Scripted Bolt code under review. The ask: hi to each friend, then say how many snacks Rex has. Planted bug: visit also takes a snack per friend, which was not asked.`

## 5. `rex-check` · Boss: Rex check · core, **boss** · `bugzap`

**One idea:** plan your tests (what should come out), then hunt. More than one bug can hide.
**Misconception:** "I found one bug, so I'm done."

```python
def snack(tricks):
    if tricks > 3:
        return "big"
    if tricks > 0:
        return "small"

print(snack(5))
print(snack(1))
```

There are two planted bugs:

- the border: `snack(3)` gives `small`. Fix: `>= 3`.
- the missing 0: `snack(0)` gives `None`. Fix: a last `return "none"`.

- `success`: `Every trick count gets the right snack.`
- `go`: `3 or more tricks: big. 1 or 2: small. 0: none. Two mistakes.`
- Steps:
  1. `match` "Plan tests. 5+ walks: gold. 1–4: silver. 0: none.": `stars(5)` ↔ `gold`,
     `stars(2)` ↔ `silver`, `stars(0)` ↔ `none`. The student understands "expected first"
     because they give the answers before any run.
  2. `walk` "Walk through stars(5)." on
     `def stars(walks): / if walks > 5: return "gold" / return "silver" / print(stars(5))`:
     Test 5. → 5 > 5? No. → Skips to silver. → Planned gold. Got silver! They understand how a
     plan catches a bug because the plan and the output disagree.
- Checks:
  - `calls('3 tricks get big', 'Test the border.', 'snack(3) == "big" and snack(5) == "big" and snack(2) == "small"')`;
  - `calls('0 tricks get none', 'Test the smallest number.', 'snack(0) == "none" and snack(1) == "small"')`;
  - `notes(2, 'Add # and your words.')`, `bugNote(2)`.
- `prompt`:
  `Scripted Bolt code under review. Rule: 3+ tricks big, 1 or 2 small, 0 none. Two planted bugs: snack(3) says small, and snack(0) returns None.`

## 6. `ask-and-check` · Ask and check · choice · kind `direct`

**One idea:** real AI code gets the same review, and "no bug" is a real answer if you tested.
**Misconception:** "The real Bolt is always right," or "I must find something."

Starter: `''`. There is no planted bug. The student asks the real Bolt for one Rex trick and
copies it into the editor. Then they run it, test it and write `# bug:`: a real bug, or `none`
plus what they tried.

- `success`: `You tested Bolt's code yourself.`
- `go`: `Ask Bolt for one Rex trick. Test it. Write # bug:.`
- Steps:
  1. `learn` "Ask. Test. Say what you found.", in 3 frames:
     - `# ask: Rex says he is 3`: Ask Bolt for one thing.
     - `# bug: none, it said I am 3`: Right? Say none, and why.
     - `# bug: it said 4, I asked 3`: Wrong? Say what it did.
- Checks: `runs`, `ask()`, `notes()`, `bugNote()`. The empty starter fails `runs`. Sparky judges
  the `# bug:` line against the ask, the code and the runs.
- `prompt`:
  `No planted bug: the student asks the real Bolt for one trick and tests it. Judge # bug: against their ask, code and runs.`

## 7. `hw-rex-diary` · Rex's diary · bonus · `bugzap`

**One idea:** the right value comes from the right box.

```python
def diary(food, toy):
    return "Rex ate " + toy + " and played with " + toy

print(diary("cake", "ball"))
```

Planted bug: the wrong variable (`toy` for `food`). Fix: `"Rex ate " + food`.

- `success`: `The diary says what Rex did.`
- `go`: `Bolt wrote Rex's diary. Is it true?`
- Steps:
  1. `stage` boxes "Rex ate a bone. Put it in ate.". Boxes: `food = bone`, `toy = stick`, and
     an empty `ate`. Blocks: `ate = toy`, `ate = food`. Solution `[1]`.
- Checks:
  - `calls('The diary is true', 'What went in? What came out?', 'diary("cake", "ball") == "Rex ate cake and played with ball" and diary("fish", "bone") == "Rex ate fish and played with bone"')`.
    A hard-coded string fails it.
  - `notes()`, `bugNote()`.
- `prompt`:
  `Scripted Bolt code under review. Planted bug: the diary says Rex ate his toy, not his food.`

## 8. `hw-bolt-right` · Is Bolt right? · bonus · kind `explain`

**One idea:** a review can end in "no bug", but only with proof. **Misconception:** "Every review
finds a bug, so I must change something."

```python
def walker(age):
    if age >= 10:
        return "yes"
    return "no"

print(walker(12))
```

No bug. The rule has one border (age 10), so there is no second limit to argue about. The code is
right for every whole number. The student adds test prints (9 and 10) and writes
`# bug: none, …` with what they tried.

- `success`: `You tested it and said what you found.`
- `go`: `Bolt wrote this. Rex walkers must be 10 or older. Bug?`
- Steps:
  1. `choose` "It all works. Which # bug: line?". Options `fixed it`, `none: 9, 10 and 12 work`,
     `none`, answer 1, explain `No bug is fine. Say what you tried.` The student understands
     that a bare "none" is not enough because it loses to one with proof.
- Checks:
  - `match('You added a test', 'Print walker with a new age.', '^\\s*print\\(\\s*walker\\(', 'print(walker(10))', 2)`.
    The starter has one test, so it fails.
  - `calls('It still works', 'Keep the code that works.', 'walker(10) == "yes" and walker(9) == "no"')`.
    Breaking the correct code fails it.
  - `notes()`, `bugNote()`.
- `prompt`:
  `Scripted Bolt code under review. No planted bug: the code is right. # bug: none plus what they tried is correct.`

## 9. `hw-bug-rex` · Fix the crash · bonus · `bugzap` (in `bugzap.py`)

**One idea:** a crash is the easy kind of bug, because the red text tells you. This builds on
Week 6.

```python
# TASK: hw-bug-rex
tricks = ["sit", "spin", "jump"]
print("Last trick: " + tricks[3])
print("Rex done!")
```

Planted bug: `IndexError`, because there is no `tricks[3]`. Fix: `tricks[2]` or `tricks[-1]`.

- `success`: `bugzap.py says the last trick.`
- No steps and no `go`, like Week 8's `hw-bug-pet`.
- Checks:
  - `output('Rex says his last trick', 'Read the red text.', 'Last trick: jump', { file: 'bugzap.py' })`.
    It fails on the crash and when the line is deleted.
  - `notes(1, 'Add a # note on your fix.')`, `bugNote()`.
- `prompt`:
  `Scripted Bolt code under review in bugzap.py. Planted bug: it crashes asking for a trick the list does not have.`

---

## Owner decisions

1. **Reading-load cap: A.** In `lesson-copy.test.ts`'s total, a label or hint that repeats inside
   a lesson counts once. This lands in group 2, with lesson 109.
2. **The real Bolt can fix the planted bug: accepted.** Bolt doesn't change. The student's own
   work is the `# bug:` line, the notes and Sparky's judgement.
3. **Boss: as drafted.** Two mistakes: the border and the missing 0.
4. **`just-asked`: as drafted.** The extra is the hidden snack side effect.
5. **`ask-and-check` keeps `ask()`.**
