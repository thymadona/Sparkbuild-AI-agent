# Week 10 — Rex's Party: step sketch

**Approved by the owner (2026-09-25).** Plan group 1. Groups 2 and 5 build exactly this.

Lesson 110, `Week #10 — Rex's Party`, `aiPolicy: 'director'`, plan-first, badge **Party
Planner**. Description: "Rex has a party. Plan each part before you build it." Every task is its
own program with an empty starter (`own: { starter: '' }`), except `hw-bug-party` in `bugzap.py`.

## Rules for the whole week

- **Idea of the week:** before code, say what you want (`# goal:`), the small pieces in order
  (`# step:`), and how you will know it worked (`# done:`). Then build it, run it, and check the
  run against `# done:`.
- **The plan lines**, each with 3+ words after the colon:
  - `# goal: Rex says welcome to his party`: what the program shows, not "a cool party";
  - `# step: print each snack`: one small piece, and there can be several;
  - `# done: I see 3 invites, then Bye`: something you will see on screen, not "it works".
- **Plan check labels** (repeated labels count once per lesson):
  - `goal()`: `You wrote # goal:` / `Say what Rex will show.`
  - `steps(n)`: `You wrote n # step: lines` / `One small piece per line.`
  - `done()`: `You wrote # done:` / `Say what you will see.`
- **Every task also has** `notes(1, 'Add # and your words.')`, the week 8/9 own-words rule.
- **Who writes the code:** tasks 1–4 and 7–9, the student (the `go` lines never mention Bolt).
  Tasks 5 and 6, Bolt, from the plan, via an `# ask:` line. Bolt is open everywhere once a plan
  exists.
- **Bad plans only in steps.** Starters are empty, so a vague goal or done-check is shown in a
  `learn`, `bug`, `choose` or `order` step, never in the editor.
- **Tutor-only `prompt`:** one terse line per task: "Plan task", what the goal must show, and what
  the behaviour check proves.

## Anti-repetition

| #   | Task                    | Step types, in order | Taught here                                  |
| --- | ----------------------- | -------------------- | -------------------------------------------- |
| 0   | w9 `hw-bolt-right`      | choose               | (week 9's last task with steps)              |
| 1   | `party-goal`            | learn → choose       | **plan first**; a goal you can see           |
| 2   | `party-invite`          | stage (room) → bug   | **done = what you see**; "it works" is not   |
| 3   | `party-snacks`          | order → match        | small steps, in order; a step ↔ its code     |
| 4   | `party-game`            | walk → choose        | a done-check with an input, matched to a run |
| 5   | `party-show` (boss)     | order → learn        | plan → ask Bolt → check against `done:`      |
| 6   | `plan-for-bolt`         | match                | the four lines and their jobs                |
| 7   | `hw-cake`               | bug                  | steps must lead to the done-check            |
| 8   | `hw-gifts`              | stage (boxes)        | the done-check is the goal you reach         |
| 9   | `hw-bug-party` (bugzap) | no steps, no `go`    | read the red text, then plan the fix         |

No type repeats between neighbouring tasks. `choose` appears twice (tasks 1 and 4), `order`
twice (3 and 5), `match` twice (3 and 6), and they are never neighbours.

## Difficulty ramp

1. One plan line, then one print.
2. Two plan lines, and a done-check with a count.
3. The whole plan with several steps, and a list plus a loop (weeks 3–4).
4. The whole plan with `input()` and `if`: the done-check names what you type and what you see.
5. Boss: the whole plan, then Bolt builds it, then check the run against `done:`.
6. Choice: your own party part, the real Bolt, no fixed output.
7. Bonus: a countdown, where the steps must lead to the done-check.
8. Bonus: a dictionary of gifts (week 7), with a done-check you can test.
9. Bonus: a crash, fixed, with a `done:` that says what it prints now.

## Reading load

Measured on `main` (2026-09-25): task copy 2293 of a 3000 cap (~700 left); step copy 2513 of a
2800 cap (286 left). The step copy below is 266 words, counted the way `lesson-copy.test.ts`
counts it.

---

## 1. `party-goal` · Plan the party · core · kind `make`

**One idea:** a plan starts with a goal that says what the program will show. **Misconception:**
"the goal is the topic" (`# goal: a party`).

Success: `Your goal says what Rex shows.`
Prompt (tutor-only): `Plan task. The # goal: must say what Rex prints; the output check proves it.`

Solution:

```python
# goal: Rex says welcome to his party
print("Welcome to my party!")  # Rex says hi
```

Checks:

- `output('Rex talks about the party', 'Print a line with party.', 'party', { flags: 'i' })`
- `goal()`, `notes(1, 'Add # and your words.')`

Steps:

1. `learn` "Plan first. Then code.":
   - `# goal: a party` / note `What will we see?`
   - `# goal: Rex says welcome` / note `Now we know what shows.`
   - `print("Welcome!")  # Rex says hi` / note `The code does the goal.`
2. `choose` "Which goal can you see?":
   `make it fun` · `Rex says party at 5` · `a cool party`. The answer is 1. Explain: `You can see if it happened.`
   The student understands that a goal must be visible because they reject two goals you can't check.

`go`: `Write # goal: first. Then make Rex say it.`

## 2. `party-invite` · Send invites · core · kind `make`

**One idea:** `# done:` says what you'll see on screen when it works. **Misconception:** "done
means no red text".

Success: `Rex invites 3 friends.`
Prompt: `Plan task. # done: must name what shows on screen; 3+ lines with a name and "party".`

Solution:

```python
# goal: Rex invites 3 friends to his party
# done: I see 3 invites
print("Tom, come to my party!")  # invite 1
print("Ana, come to my party!")
print("Sam, come to my party!")
```

Checks:

- `output('3 friends get an invite', 'One print per friend.', '(?:party[^\n]*\n[\s\S]*){2}party', { flags: 'i' })`.
  Group 2 settles the regex: three lines containing "party".
- `goal()`, `done()`, `notes(1, …)`

Steps:

1. `stage` room: "Done: Rex says Hi Tom, then Hi Ana." Palette: `say Hi Tom` (`say:Hi Tom`),
   `say Bye` (`say:Bye`), `say Hi Ana` (`say:Hi Ana`). Solution `[0, 2]`.
   The student understands that a done-check is something you watch happen because they make it
   happen and see it.
2. `bug` "Which line shows nothing on screen?"
   ```
   # goal: Rex invites Tom
   # done: it works
   print("Tom, come!")
   ```
   The bug line is 2. Explain: `Say what shows, not "it works".`

`go`: `Write # goal: and # done:. Then invite 3 friends.`

## 3. `party-snacks` · Snack table · core · kind `make`

**One idea:** split the goal into small steps, in the order they must run. **Misconception:**
"a plan is one big line".

Success: `Rex shows each snack, then how many.`
Prompt: `Plan task. 2+ # step: lines in run order; output lists the snacks then a count.`

Solution:

```python
# goal: Rex shows his snacks and how many
# step: make a list of snacks
# step: print each snack
# step: print how many
# done: I see 3 snacks, then 3
snacks = ["cake", "fish", "bone"]
for snack in snacks:
    print(snack)  # one snack
print(len(snacks))
```

Checks:

- `output('Snacks, then how many', 'Print each snack. Then len().', '\\D[\\s\\S]*\\n\\d+\\s*$')`.
  Group 2 settles it: a word line, then a last line that is only a number.
- `goal()`, `steps(2)`, `done()`, `notes(1, …)`

Steps:

1. `order` "Put the plan in order.": `# step: make a list of snacks` · `# step: print each snack`
   · `# step: print how many`.
   The student understands that steps have an order because printing before the list can't work.
2. `match` "Tap a step. Tap its code.": `make a list` → `snacks = ["cake"]`, `print each` →
   `for s in snacks:`, `how many` → `print(len(snacks))`.
   Left is the step and right is the code, so the right side is code-ish and costs few words.

`go`: `Plan 3 steps. Then build the snack table.`

## 4. `party-game` · Party game · core · kind `make`

**One idea:** a done-check can name what you type and what you'll see. **Misconception:** "you
can't plan a game, it changes".

Success: `Type 7 and Rex says you win.`
Prompt: `Plan task. input() game: 7 wins, anything else does not. # done: names an input and its output.`

Solution:

```python
# goal: Rex plays a number game
# step: ask for a number
# step: say win if it is 7
# done: I type 7 and see You win
n = int(input("Number? "))
if n == 7:
    print("You win!")  # the magic number
else:
    print("Try again")
```

Checks:

- `output('7 wins', 'Check the number is 7.', 'win', { flags: 'i', inputs: ['7'] })`
- `output('3 does not win', 'Only 7 wins.', '^(?![\\s\\S]*win)', { flags: 'i', inputs: ['3'] })`
- `goal()`, `steps(2)`, `done()`, `notes(1, …)`

Steps:

1. `walk` "Type 5. Walk the game.", on the same shape of code with `5` as the magic number
   (the steps never show the editor's answer):
   - line 1, `n = 5`, out `Number? 5`, note `I type 5, like my done.`
   - line 2, note `5 == 5? Yes.`
   - line 3, out `You win!`, note `I see You win. Done!`
2. `choose` "Which # done: can you test?":
   `it is fun` · `I type 5, see You win` · `no red text`. The answer is 1. Explain:
   `Type it, run it, look.`

`go`: `Plan the game: goal, steps, done. 7 wins.`

## 5. `party-show` · Boss: Rex's show · core, **boss** · kind `direct`

**One idea:** plan first, then Bolt builds your plan, then you check its run against `done:`.
**Misconception:** "Bolt knows what I want".

Success: `Rex does 3 tricks, then says Bye.`
Prompt: `Plan task, Bolt builds it. Output: 3 trick lines then Bye. Judge the run against # done:.`

Solution:

```python
# goal: Rex does a show with 3 tricks
# step: Rex does 3 tricks
# step: Rex says Bye
# done: I see 3 tricks, then Bye
# ask: print sit, spin, jump, then Bye
for trick in ["sit", "spin", "jump"]:
    print(trick)  # one trick
print("Bye!")  # show ends
```

Checks:

- `output('3 tricks, then Bye', 'Bye comes last.', '\\S+\\n\\S+\\n\\S+\\nBye', { flags: 'i' })`.
  Group 2 settles the regex.
- `goal()`, `steps(2)`, `done()`, `ask()`, `notes(2, 'After each line: # and your words.')`

Steps:

1. `order` "Plan, then ask. Tap in order.": `# goal: Rex does a show` · `# step: Rex does 3 tricks`
   · `# done: I see 3 tricks, then Bye` · `# ask: build my plan`.
2. `learn` "Plan. Ask Bolt. Check.":
   - `# ask: build my plan` / note `Bolt waits for your plan.`
   - `print("Bye!")  # show ends` / note `Copy it. Add your # notes.`
   - `# done: I see 3 tricks, then Bye` / note `Run it. Does it match?`

`go`: `Plan the show. Then ask Bolt for it.`

## 6. `plan-for-bolt` · Your party part · choice · kind `direct`

**One idea:** the whole loop on your own idea: plan, ask the real Bolt, check the run.
**Misconception:** "if Bolt made it, it matches my plan".

Success: `Bolt built your plan. You checked it.`
Prompt: `Plan task, the student's own idea. Bolt builds it. Judge # goal:/# done: and the run against each other.`

Checks: `runs`, `goal()`, `done()`, `ask()`, `notes(1, …)`. The behaviour check is only `runs`,
because the idea is theirs (week 9 `ask-and-check` style).

Steps:

1. `match` "Tap a line. Tap its job.": `# goal:` → `what it shows`, `# step:` → `one small piece`,
   `# done:` → `what you will see`, `# ask:` → `what Bolt builds`.

`go`: `Plan your own party part. Then ask Bolt.`

## 7. `hw-cake` · Cake countdown · bonus · kind `make`

**One idea:** the steps must lead to the done-check, in its order. **Misconception:** "any order
of steps is fine".

Success: `Rex counts 3, 2, 1, then Cake!`
Prompt: `Plan task. Countdown 3 2 1 then Cake; the steps must match the done order.`

Solution:

```python
# goal: Rex counts down to cake
# step: count 3, 2, 1
# step: Rex says Cake
# done: I see 3, 2, 1, then Cake
for n in range(3, 0, -1):
    print(n)  # count down
print("Cake!")
```

Checks: `output('3, 2, 1, then Cake', 'Count down first.', '3\\s+2\\s+1\\s+Cake', { flags: 'i' })`,
`goal()`, `done()`, `notes(1, …)`

Steps:

1. `bug` "Which step is in the wrong place?"
   ```
   # goal: count down to cake
   # step: Rex says Cake
   # step: count 3, 2, 1
   # done: I see 3, 2, 1, then Cake
   ```
   The bug line is 2. Explain: `Cake comes last, like done.`

`go`: `Plan the countdown. Steps follow # done:.`

## 8. `hw-gifts` · Party gifts · bonus · kind `make`

**One idea:** a done-check you can test names who gets what. **Misconception:** "done = every
friend is happy".

Success: `Each friend gets a gift.`
Prompt: `Plan task. A dict of friend to gift; print one line per friend with "gets".`

Solution:

```python
# goal: each friend gets a gift
# step: put friends and gifts in a dict
# step: print who gets what
# done: I see Tom gets ball, Ana gets cake
gifts = {"Tom": "ball", "Ana": "cake"}
for name in gifts:
    print(name, "gets", gifts[name])  # one gift
```

Checks: `output('2 friends get gifts', 'Print name gets gift.', '(?:gets[\\s\\S]*){2}', { flags: 'i' })`,
`goal()`, `done()`, `notes(1, …)`

Steps:

1. `stage` boxes: "Done: Tom gets ball, Ana gets cake." Boxes `Tom`, `Ana` (empty). Palette:
   `Tom: ball` (`set:Tom=ball`), `Ana: bone` (`set:Ana=bone`), `Ana: cake` (`set:Ana=cake`).
   Goal `{ Tom: 'ball', Ana: 'cake' }`, solution `[0, 2]`.
   The student understands that a done-check is a goal you can test because the boxes win only when they match it.

`go`: `Plan the gifts. # done: says who gets what.`

## 9. `hw-bug-party` · Fix the party · bonus (bugzap)

**One idea:** a crash fix has a done-check too. The week's only crash.

Starter (`py/w10-bugzap.py`):

```python
# TASK: hw-bug-party
guest = 3
print("Guests: " + str(guests))
```

Success: `bugzap.py says Guests: 3.` Fix: `guests`. Checks: `output('It says Guests: 3', 'Read the red text.', 'Guests: 3', { file: 'bugzap.py' })`,
`done()`, `notes(1, 'Add a # note on your fix.')`.
Prompt: `Plan task in bugzap.py. Planted crash: NameError, guests is not the name made.`
No steps and no `go`, like every bugzap.
