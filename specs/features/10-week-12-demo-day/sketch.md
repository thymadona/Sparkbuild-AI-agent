# Week 12 — Rex's Demo Day: step sketch

**Approved by the owner (2026-09-26).** Plan group 1. Groups 2 and 4 build exactly this.

Lesson 112, `Week #12 — Rex's Demo Day`, not `director` (Bolt off), demo flag, badge
**Demo Star**. Description: "Show Rex's quiz and say how it works." The four demo tasks are one
program chained with `from`, and the bonuses `hw-answer` and `hw-cheer-up` build on the boss.
`demo-own` is its own program with an empty starter. `hw-bug-demo` is in `bugzap.py`.

## Rules for the whole week

- **Idea of the week:** a demo shows three things: what the program does (run it, `# done:`),
  how it works (a `#` note per line, and why), and that you can change it live.
- **The starter** (`demo-run`'s `starter`) is the finished Week 11 show as code only:

  ```python
  name = input("Your name? ")
  print("Hi " + name + "! Welcome to Rex's show")
  quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}
  score = 0
  for q in quiz:
      if input(q) == quiz[q]:
          print("Right!")
          score = score + 1
  print("Score:", score)
  ```

- **Who writes the code:** the student, every task. There is no Bolt this week.
- **Demo questions:** the tutor-only `prompt` names them. There is one in each core task and in
  the choice, and three in the boss. There are none in the bonuses.
- **Inputs, in order:** the name, then the answers (4, 9, 6, then 10 once `demo-change` adds it).

## Anti-repetition

| #   | Task                   | Step types, in order | Taught here                           |
| --- | ---------------------- | -------------------- | ------------------------------------- |
| 0   | w11 `hw-riddle`        | order                | (week 11's last task with steps)      |
| 1   | `demo-run`             | learn → choose       | **a demo has three parts**; `# done:` |
| 2   | `demo-explain`         | walk → match         | how the loop works; a note per line   |
| 3   | `demo-change`          | bug → stage (boxes)  | change it live; `"10"` is text        |
| 4   | `demo-day` (boss)      | order → match        | the whole demo; good answers          |
| 5   | `demo-own` (choice)    | choose               | demo your own program                 |
| 6   | `hw-answer`            | order                | `else` tells the right answer         |
| 7   | `hw-cheer-up`          | choose               | `<` for a low score                   |
| 8   | `hw-bug-demo` (bugzap) | no steps, no `go`    | the number vs text bug, fixed alone   |

No type repeats between neighbouring tasks (task 0 → 1 included).

## Difficulty ramp

1. Run it, and say what you see in a `# done:` (nothing to code).
2. Explain it: a note per line, one "why" out loud.
3. Change it live: one new question in the dictionary, and the score grows by itself.
4. Boss: add Rex's cheer by hand (`if` + `name`), then the full demo with three questions.
5. Choice: a small program of your own, built alone and demoed.
6. Bonus: `else` on a finished program.
7. Bonus: `<` on a finished program.
8. Bonus: the number vs text bug, fixed alone.

## Reading load

The step copy below is about **215 words**, under the 338 left. Task copy (chips, success,
labels, hints) is about 200 of the 825 left. Group 4 measures both exactly.

---

## 1. `demo-run` · Run Rex's show · core · kind `direct` · `starter`: the show

**One idea:** a demo starts with what the program shows. **Misconception:** "a demo is
reading the code out loud".

Success: `Your # done: matches the run.`
Prompt: `Finished show, run as is. Add # done: for all right (Score: 3). Demo question: what happens with a wrong answer.`

Solution: the starter plus `# done: I answer 4, 9 and 6 and see Score: 3` on the first line.

Checks: `output('All right shows Score: 3', 'Answer 4, 9 and 6.', 'score\\W*3', { flags: 'i', inputs: ['Mia', '4', '9', '6'] })`,
`doneCheck()`.

Steps:

1. `learn` 'A demo shows three things.' (they understand what a demo is because they see its
   three parts):
   - `# done: I see Score: 3` · 'What it does.'
   - `score = 0  # start at zero` · 'How it works.'
   - `"5 + 5? ": "10"` · 'You change it live.'
2. `choose` 'You type 5 for 2 + 2. What prints?' with code
   `if input(q) == quiz[q]:\n    print("Right!")`: 'Right!' · **'nothing'** · 'Score: 5'.
   Explain: '5 is not "4", so Rex skips it.' (the first "what if" of a demo).

Go: `Run the show. Write a # done: line.`

## 2. `demo-explain` · Say how it works · core · kind `explain` · `from: demo-run`

**One idea:** each line has a job, and you can say it. **Misconception:** "if it runs, I
understand it".

Success: `Each line has your note.`
Prompt: `Same show: own-words # notes on 5 lines or more. Demo question: why one line is there.`

Checks: `output('All right shows Score: 3', 'Answer 4, 9 and 6.', 'score\\W*3', { flags: 'i', inputs: ['Mia', '4', '9', '6'] })`
(notes that break the program don't count), `notes(5, 'After each line: # and your words.')`.

Steps:

1. `walk` 'Watch the loop go.' on
   `quiz = {"2 + 2? ": "4", "3 x 3? ": "9"}\nfor q in quiz:\n    print(quiz[q])`:
   line 1 · 'Two questions, two answers.' → line 2 · 'q is the first question.' → line 3, out
   `4` · 'Rex shows its answer.' → line 2 · 'q is the next question.' → line 3, out `9` ·
   'Every question, one by one.' (they understand the loop because they watch it take each
   question).
2. `match` 'Tap a line. Tap what it does.': `for q in quiz:` ↔ 'each question' ·
   `if input(q) == quiz[q]:` ↔ 'a right answer?' · `score = score + 1` ↔ 'one more point'.

Go: `Add a # note after each line.`

## 3. `demo-change` · Add a question live · core · kind `change` · `from: demo-explain`

**One idea:** a good program changes in one place. **Misconception:** "a new question needs a
new `if`".

Success: `Rex asks 5 + 5 too.`
Prompt: `Change live: add "5 + 5? ": "10"; all right shows Score: 4. Update # done:. Demo question: why no new if is needed.`

Checks: `output('All right shows Score: 4', 'Answer 4, 9, 6 and 10.', 'score\\W*4', { flags: 'i', inputs: ['Mia', '4', '9', '6', '10'] })`,
`doneCheck()`.

Steps:

1. `bug` 'Rex added 5 + 5. Which line is wrong?' on
   `quiz = {"2 + 2? ": "4", "5 + 5? ": 10}\nscore = 0\nfor q in quiz:\n    if input(q) == quiz[q]:\n        score = score + 1`,
   bug line 0. Explain: 'input gives text, so write "10".'
2. `stage (boxes)` 'You got 4 right. Give Rex 4 points.': box `score`; goal `score = 4`;
   palette `score = 0` (`set:score=0`), `score = score + 1` (`add:score:1`); solution
   `[0, 1, 1, 1, 1]` (the loop adds one point per question, with no new code).

Go: `Add "5 + 5? " to the quiz. Fix your # done:.`

## 4. `demo-day` · Boss: Rex's Demo Day · core · boss · kind `direct` · `from: demo-change`

**One idea:** the whole demo: it runs, it matches `# done:`, and you answer questions about it.
**Misconception:** "a good answer is a long one".

Success: `Rex cheers, and you answer 3 questions.`
Prompt: `Boss, alone: all 4 right prints "Perfect show, <name>!"; # done: must match the run. Demo: three questions, one per turn: what it does, why one line is there, what if.`

Adds, at the end:

```python
if score == 4:  # all right?
    print("Perfect show, " + name + "!")  # Rex cheers you
```

Checks: `output('All right: Perfect show', 'Answer 4, 9, 6 and 10.', 'perfect show, mia', { flags: 'i', inputs: ['Mia', '4', '9', '6', '10'] })`,
`doneCheck()`, `notes(6, 'After each line: # and your words.')`.

Steps:

1. `order` 'Put your demo in order.': 'Run the show' · 'Say what you see' · 'Say how it works' ·
   'Answer a question' (they understand a demo has a shape because they build it).
2. `match` 'Tap a question. Tap a good answer.': 'What does it do?' ↔ 'asks 4 sums, shows the
   score' · 'Why score = 0?' ↔ 'no points yet' · 'Why a for loop?' ↔ 'it asks every question'
   (they understand a good answer is short and in their words because they pick them).

Go: `Add Rex's cheer. Then give your demo.`

## 5. `demo-own` · Demo your own program · choice · kind `make` · own program

**One idea:** the same demo, on a program you wrote. Success: `Your program, your words.`
Prompt: `The student's own small program, written alone. # done: must match the run. Demo question: why one line is there.`

Solution (an example):

```python
# done: I type Mia and see Hi Mia, you are a star
name = input("Name? ")  # ask the name
print("Hi " + name + ", you are a star")  # say it back
```

Checks: `runs3`, `doneCheck()`, `notes(2, 'After each line: # and your words.')`.

Steps: `choose` 'Which # done: can a run show?': 'it works' · **'I see Hi Mia'** · 'it is fun'.
Explain: 'A run shows words, so you can check them.'

Go: `Write a small program. Then demo it.`

## 6. `hw-answer` · Rex tells the answer · bonus · kind `change` · `from: demo-day`

Success: `A wrong answer shows the right one.` Adds `else:  # a wrong answer` /
`    print("It was", quiz[q])  # Rex tells it` to the `if` in the loop.

Checks: `output('Wrong shows the answer', 'Answer 5 for 2 + 2.', 'it was 4', { flags: 'i', inputs: ['Mia', '5', '9', '6', '10'] })`,
`notes(7, 'After each line: # and your words.')`.

Steps: `order` 'Tap the lines in order.': `if input(q) == quiz[q]:` · `    print("Right!")` ·
`else:` · `    print("It was", quiz[q])`.

Go: `Add an else. Rex says the answer.`

## 7. `hw-cheer-up` · Cheer up the player · bonus · kind `change` · `from: demo-day`

Success: `One right shows Try again.` Adds `if score < 2:  # a low score` /
`    print("Try again!")  # Rex cheers you up` at the end.

Checks: `output('Low score: Try again', 'Get only 2 + 2 right.', 'try again', { flags: 'i', inputs: ['Mia', '4', '1', '1', '1'] })`,
`notes(7, 'After each line: # and your words.')`.

Steps: `choose` 'You get 1 right. What prints?' with code `if score < 2:\n    print("Try again!")`:
**'Try again!'** · 'nothing' · 'Perfect show!'. Explain: '1 is less than 2, so it prints.'

Go: `Add Try again! for a low score.`

## 8. `hw-bug-demo` · Fix the 10 bug · bonus · kind `bugzap` · `bugzap.py`

Success: `Type 10 and see Score: 1.` Prompt: `Bugzap in bugzap.py. Planted bug: 10 is a number, but input gives text, so it never matches.`
Starter (it runs, but a right answer scores 0):

```python
# TASK: hw-bug-demo
score = 0
answer = input("5 + 5? ")
if answer == 10:
    score = score + 1
print("Score:", score)
```

Fix: `if answer == "10":  # input gives text`, plus `# done: I type 10 and see Score: 1`.

Checks: `output('It shows Score: 1', 'Type 10. Then look for Score.', 'score\\W*1', { flags: 'i', file: 'bugzap.py', inputs: ['10'] })`,
`doneCheck()`, `notes(1, 'Add a # note on your fix.')`.
