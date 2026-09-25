# Week 11 — Rex's Game Show: step sketch

**Waiting for owner approval.** Plan group 1. Groups 2 and 4 build exactly this.

Lesson 111, `Week #11 — Rex's Game Show`, `aiPolicy: 'director'`, `planFirst`, step-by-step,
badge **Show Builder**. Description: "Build Rex's quiz show, one step at a time." The four
show tasks are one program chained with `from`; `show-extra` and `hw-riddle` are their own
programs with an empty starter; `hw-bug-show` is in `bugzap.py`.

## Rules for the whole week

- **Idea of the week:** a big program is built one small step at a time. Plan it all, ask Bolt
  for **one** step, copy it in, add notes, say why it works, run it, then take the next step.
- **The project plan** (written in task 1, carried to task 4):

  ```python
  # goal: Rex runs a quiz and tells your score
  # step: say hi to the player by name
  # step: ask one question and say if right
  # step: keep a score
  # step: ask 3 questions and show the score
  # done: I answer 3 questions and see Score: 3
  ```

- **One `# ask:` per step.** `ask(1)` → `ask(4)` along the chain; the hint `One # ask: per
piece.` already exists. Notes grow the same way.
- **Inputs, in order:** the name, then the answers. The sums are fixed: 2 + 2, 3 x 3, 10 - 4.
- **Who writes the code:** the core tasks, the choice and `hw-riddle`: Bolt, one step per ask.
  `hw-prize`: the student or Bolt. `hw-bug-show`: the student.
- **Tutor-only `prompt`:** one terse line per task: which step, what it prints, and "ask why
  about one Bolt line".

## Anti-repetition

| #   | Task                   | Step types, in order  | Taught here                               |
| --- | ---------------------- | --------------------- | ----------------------------------------- |
| 0   | w10 `hw-gifts`         | stage (boxes)         | (week 10's last task with steps)          |
| 1   | `show-plan`            | learn → order         | **a big job is small steps**; ask for one |
| 2   | `show-question`        | choose → walk         | an ask for one step; why the `if` works   |
| 3   | `show-score`           | stage (boxes) → match | a score in a box; **say why** each line   |
| 4   | `show-final` (boss)    | bug → learn           | Bolt's loop has a mistake; check `done:`  |
| 5   | `show-extra` (choice)  | try                   | your own show, two steps                  |
| 6   | `hw-prize`             | choose                | one more step on a finished program       |
| 7   | `hw-riddle`            | order                 | plan, ask, plan, ask                      |
| 8   | `hw-bug-show` (bugzap) | no steps, no `go`     | text + number crash                       |

No type repeats between neighbouring tasks (task 0 → 1 included). Task 3's `stage (boxes)` is
not a neighbour of week 10's.

## Difficulty ramp

1. The whole plan, then one Bolt step: a name in, a greeting out.
2. The second step joins the first: `input()` and `if` (weeks 2 and 5).
3. A score that changes inside the `if` (week 2 boxes).
4. Boss: a dictionary loop with the score (weeks 4 and 7), checked against `# done:`.
5. Choice: the same process on the student's own idea, two steps.
6. Bonus: one step added to a finished program.
7. Bonus: a new two-step program, one ask each.
8. Bonus: a crash fixed by hand, with a `# done:` for the fix.

## Reading load

Measured on `main` (2026-09-25), after adding an 11th lesson with steps: task copy 2520 of a
3300 cap; step copy 2786 of a 3080 cap (294 left). The step copy below is **232 words**.

---

## 1. `show-plan` · Plan the game show · core · kind `direct`

**One idea:** a big program is a plan of small steps, and you build only one at a time.
**Misconception:** "ask the AI for the whole thing".

Success: `Your plan is ready. Rex says hi.`
Prompt: `Project plan, then step 1 by Bolt: greet the typed name. Ask why about one Bolt line.`

Solution (after the plan above):

```python
# ask: say hi to the player by name
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex says hi
```

Checks: `output('Rex says your name', 'Type a name when it asks.', 'Mia', { inputs: ['Mia'] })`,
`goal()`, `planSteps(4)`, `doneCheck()`, `ask(1)`, `notes(1, 'Add # and your words.')`.

Steps:

1. `learn` 'A big job is small steps.' (the student understands a whole show is too big for one
   ask because they see it split):
   - `# goal: Rex runs a quiz show` · 'Too big for one ask.'
   - `# step: say hi by name` · 'Step 1 is small.'
   - `# ask: say hi by name` · 'Ask Bolt for one step.'
2. `order` 'Put the show steps in order.': `# step: say hi by name` · `# step: ask one question` ·
   `# step: keep a score` · `# step: ask 3 questions` (they understand a step needs the one
   before because they sequence them).

Go: `Plan the whole show. Then ask Bolt for step 1.`

## 2. `show-question` · Step 2: one question · core · kind `direct` · `from: show-plan`

**One idea:** an ask names one step, exactly. **Misconception:** "a bigger ask saves time".

Success: `Rex asks 2 + 2 and says Right.`
Prompt: `Step 2 by Bolt: ask "2 + 2? ", print Right! for 4. The new # ask: is this step only. Ask why about one Bolt line.`

Adds:

```python
# ask: ask 2 + 2 and say Right! for 4
answer = input("2 + 2? ")  # Rex asks a sum
if answer == "4":  # 4 is the right answer
    print("Right!")  # Rex cheers
```

Checks: `output('Rex says Right for 4', 'Type 4 when Rex asks.', 'right', { flags: 'i', inputs: ['Mia', '4'] })`,
`ask(2)`, `notes(2, 'After each line: # and your words.')`.

Steps:

1. `choose` 'Which ask is one step?': 'build the whole quiz show' · **'ask 2 + 2, say Right for
   4'** · 'make it fun'. Explain: 'One step, so Bolt keeps it small.'
2. `walk` 'Watch it run. You type 4.' on
   `answer = input("2 + 2? ")\nif answer == "4":\n    print("Right!")`:
   line 1 · 'You typed 4.' → line 2 · '"4" matches, so it goes on.' → line 3, out `Right!` ·
   'Rex says Right!' (they understand why the `if` lets it through because they watch it).

Go: `Ask Bolt for step 2 only. Copy it in.`

## 3. `show-score` · Step 3: keep score · core · kind `direct` · `from: show-question`

**One idea:** a score is a box that starts at 0 and grows by 1. **Misconception:** "the score
knows by itself".

Success: `A right answer shows Score: 1.`
Prompt: `Step 3 by Bolt: score starts at 0, +1 when right, print Score. Ask why about one Bolt line.`

Changes: `score = 0  # start at zero` before the question, `score = score + 1  # one more point`
inside the `if`, and `print("Score:", score)  # show the points` at the end, with a new
`# ask: keep a score, add 1 for a right answer, show Score`.

Checks: `output('It shows Score: 1', 'Type 4. Then look for Score.', 'score\\W*1', { flags: 'i', inputs: ['Mia', '4'] })`,
`ask(3)`, `notes(3, 'After each line: # and your words.')`.

Steps:

1. `stage (boxes)` 'Give Rex 1 point.': box `score`; goal `score = 1`; palette `score = 0`
   (`set:score=0`), `score = score + 1` (`add:score=1`); solution `[0, 1]`.
2. `match` 'Tap a line. Tap why.': `score = 0` ↔ 'start at zero' · `score = score + 1` ↔ 'one
   more point' · `print("Score:", score)` ↔ 'show the points' (they understand what "say why"
   means because they pair each line with its reason).

Go: `Ask Bolt for step 3. Add a # note per line.`

## 4. `show-final` · Boss: Rex's full show · core · boss · kind `direct` · `from: show-score`

**One idea:** the last step, then check the whole run against `# done:`. **Misconception:**
"Bolt's code is right because it runs".

Success: `3 questions, then your score.`
Prompt: `Step 4 by Bolt: ask 2 + 2, 3 x 3, 10 - 4; all right shows Score: 3. Judge the run against # done:. Ask why about one Bolt line.`

Replaces the one question:

```python
# ask: ask 2 + 2, 3 x 3 and 10 - 4, add 1 for each right, show Score
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
print("Score:", score)  # show the points
```

Checks: `output('All right shows Score: 3', 'Answer 4, 9 and 6.', 'score\\W*3', { flags: 'i', inputs: ['Mia', '4', '9', '6'] })`,
`doneCheck()`, `ask(4)`, `notes(4, 'After each line: # and your words.')`.

Steps:

1. `bug` 'Bolt made a mistake. Which line?' on
   `for q in quiz:\n    score = 0\n    if input(q) == quiz[q]:\n        score = score + 1\nprint("Score:", score)`,
   bug line 1. Explain: 'score = 0 goes before the loop.'
2. `learn` 'One step. Check. Next step.':
   - `# ask: ask all 3 questions` · 'Step 4, the last one.'
   - `score = 0  # start at zero` · 'Copy it. Say why.'
   - `# done: I see Score: 3` · 'Run it. Does it match?'

Go: `Ask Bolt for the last step. Check it with # done:.`

## 5. `show-extra` · Your own mini show · choice · kind `direct` · own program

**One idea:** the same process, on your own idea. Success: `Your idea, built in 2 steps.`
Prompt: `The student's own two-step show, by Bolt, one # ask: per step. Judge # goal:/# done: against the run. Ask why about one Bolt line.`

Solution (an example):

```python
# goal: Rex runs a space show and names a planet
# step: say welcome to the space show
# step: ask a planet and say it back
# done: I type Mars and see Mars is cool
# ask: say welcome to the space show
print("Welcome to the Space Show!")  # the show starts
# ask: ask a planet and say it back
planet = input("A planet? ")  # Rex asks
print(planet + " is cool!")  # Rex says it back
```

Checks: `runs3`, `goal()`, `planSteps(2)`, `doneCheck()`, `ask(2)`, `notes(2, …)`.

Steps: `try` 'Name your show. Try 2.' on `print("Welcome to {}!")`, chips "Rex's Quiz" · 'Space
Show', need 2.

Go: `Plan your show. Build it one step at a time.`

## 6. `hw-prize` · Gold star prize · bonus · kind `make` · `from: show-final`

Success: `All 3 right shows a gold star.` Adds `# step: gold star for 3 right` and
`if score == 3:  # all right` / `    print("Gold star!")  # the prize`.

Checks: `output('3 right shows a star', 'Answer 4, 9 and 6.', 'gold star', { flags: 'i', inputs: ['Mia', '4', '9', '6'] })`,
`planSteps(5)`, `notes(5, …)`.

Steps: `choose` 'Score is 2. What prints?' with code `if score == 3:\n    print("Gold star!")`:
'Gold star!' · **'nothing'** · 'Score: 3'. Explain: 'The if needs 3, so it skips.'

Go: `Add a # step: for the prize. Then build it.`

## 7. `hw-riddle` · Rex's riddle · bonus · kind `direct` · own program

Success: `Say piano and Rex says Right.`

```python
# goal: Rex asks a riddle and says if I got it
# step: Rex asks the riddle
# step: say Right for piano
# done: I type piano and see Right!
# ask: ask What has keys but no doors?
answer = input("What has keys but no doors? ")  # the riddle
# ask: say Right! if the answer is piano
if answer == "piano":  # the right answer
    print("Right!")  # Rex cheers
```

Checks: `output('piano gets Right', 'Type piano when Rex asks.', 'right', { flags: 'i', inputs: ['piano'] })`,
`goal()`, `planSteps(2)`, `doneCheck()`, `ask(2)`, `notes(1, 'Add # and your words.')`.

Steps: `order` 'Plan, ask, plan, ask. Tap in order.': `# step: Rex asks the riddle` · `# ask:
ask the riddle` · `# step: say Right for piano` · `# ask: say Right for piano`.

Go: `Two steps, two asks. One at a time.`

## 8. `hw-bug-show` · Fix the score crash · bonus · kind `bugzap` · `bugzap.py`

Success: `Type 4 and see Score: 1.` Starter (the crash is text + number):

```python
# TASK: hw-bug-show
score = 0
answer = input("2 + 2? ")
if answer == "4":
    score = score + 1
print("Score: " + score)
```

Fix: `print("Score: " + str(score))  # str makes it text`, plus `# done: I type 4 and see Score: 1`.

Checks: `output('It shows Score: 1', 'Type 4. Then look for Score.', 'score\\W*1', { flags: 'i', inputs: ['4'] })`,
`doneCheck()`, `notes(1, 'Add # and your words.')`.
