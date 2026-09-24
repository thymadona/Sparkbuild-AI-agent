# Week 8 — Robot Pet: task-design sketch

**Status: approved by the owner (2026-09-24), open questions answered as proposed.** Plan group 2.

Story: the student builds **Rex**, a robot pet, by asking **Bolt**. Bolt builds only what the words
say, so "make a pet" gets `print("pet")`. The student learns to say exactly what they want, split a
big ask into small pieces, join the pieces themselves and explain every main line in a `#` note.

How every task works in the editor (the same loop each time, so the loop itself becomes the habit):

1. Write the request as a `# ask: …` line at the top of the editor.
2. Send the same words to Bolt (the Sparky / Bolt switch).
3. Copy the lines you want from Bolt's block into your editor. Join them and change them.
4. Add a `#` note after each main line, in your own words. Run it.

Sparky judges whether the ask is clear and the notes are the student's own (group 4). The static
checks only confirm that the ask and the notes are there, and that the program does the thing.

Each task is its own program (`task(…, own)`), except task 9, which lives in `bugzap.py` (see Notes).
No starter holds a comment. The only exception is task 9's `# TASK: hw-bug-pet` anchor.

## Step types across the week

Week 7's last task with steps was `release` (`learn · match`).

| #   | Task          | Kind   | Steps                  |
| --- | ------------- | ------ | ---------------------- |
| 1   | make-pet      | change | choose · learn         |
| 2   | exact-words   | change | bug · try              |
| 3   | in-and-out    | make   | stage:machine · learn  |
| 4   | small-pieces  | make   | choose · match · order |
| 5   | pet-game      | make   | bug · choose (boss)    |
| 6   | pet-trick     | make   | match                  |
| 7   | hw-my-pet     | make   | none (homework)        |
| 8   | hw-better-ask | change | bug                    |
| 9   | hw-bug-pet    | bugzap | none (homework)        |

No step type appears twice in a row, within a task or across a task boundary (release → 1: match →
choose, 3 → 4: learn → choose, 4 → 5: order → bug, 5 → 6: choose → match). `choose` is used 3 times,
each aimed at a real misconception: "Bolt knows what I mean", "one big ask is best", and "a note
that reads the code aloud explains it". `try` appears for the first time since week 1, because
"Sparky says exactly what you typed" is the week's idea in miniature.

Ramp: vague → exact → in/out → small pieces → boss. Notes: 1 → 2 → 2 → 3 → 4. Asks: 1 → 1 → 1 → 2 → 2.

Every string below was counted against `lesson-copy.test.ts`. The word count is in brackets where
it is close to the cap: notes, `speak`, bug `explain`, match right side, labels, chips and options
≤ 6; step prompts ≤ 10; choose `explain` ≤ 12; `go` ≤ 14. `bugLine` counts from 0.

---

```
Task: make-pet · "Make a pet"            Type: core (change)
Success: "Rex has a name and says something." (7)
One idea: Bolt builds only the words you give it. Few words, a plain program.
Misconception fixed: "the AI knows what I mean" / "it will fill in the gaps".
Story: Someone asked Bolt to "make a pet". This is what came back.
Starter: print("pet")      (Bolt's literal result; no comment says so, the go line does)
Steps:
  1. choose — hook/predict — code '# ask: make a pet', prompt "Bolt reads this ask. What does it build?" (8)
     options 'print("pet")' · 'A dog game' · 'A cat that says meow' (5), answer 0.
     explain "Bolt builds only your words. Nothing more." (7)
     The student understands Bolt is literal because they expect a real pet and get "pet".
  2. learn (3 frames) — name it, and meet the note — prompt "Say more. Get more." (4)
     '# ask: make a pet'                      "Few words. A plain pet." (5)        speak "pet"
     '# ask: a pet named Rex that says Woof'  "Name and words. Now Bolt knows." (6) speak "Rex says Woof"
     'print("Rex says Woof")  # Rex talks'    "Your # note: your own words." (6)   hl "# Rex talks"
     The student understands more exact words give a better program, and that the note is theirs,
     because each frame adds one piece.
Editor: go = 'Bolt made this from "make a pet". Ask for a name and words.' (13)
  checks = Rex says more than "pet": a printed line of 2+ words that is not "pet" (output)
           · ask() × 1 · NOTE × 1.
  Sparky judges that the name and the words are there and the ask says them.
Why not a stage: no scene shows "a request becomes a program". A prediction does, in one tap.
Ramp: predict the literal result → see a better ask → write one.
```

```
Task: exact-words · "Exact words"        Type: core (change)
Success: "Rex says your exact words." (5)
One idea: put the exact words and numbers in your ask. Bolt prints exactly those.
Misconception fixed: "says hi and his age" is enough. Bolt picks some words, maybe no number.
Story: Rex says hello and tells you how old he is.
Starter: print("Rex")
Steps:
  1. bug — hook/cause — prompt "Which line has no real age? Tap it." (8)
     code '# ask: Rex says hi and his age\nprint("Hi")\nprint("Rex is old")', bugLine 2.
     explain "No number in the ask." (5)
     The student understands a missing number comes from the ask, not from Bolt, because they
     trace the bad line back to the ask above it.
  2. try — feel it — prompt "Type Rex's exact words. Sparky says them." (7)
     need 2, chips 'Hi, I am Rex' · 'I am 3'.
     The student understands exact words come out exactly because Sparky says precisely what
     they typed, nothing added.
Editor: go = "Ask for exact words and a number. Put the words in quotes." (12)
  checks = Rex says a number: a printed line with a digit (output) · ask() × 1 · NOTE × 2.
  Sparky judges whether the ask names the exact words (decision 2).
Why not choose: the bug step already shows the cause, and `try` lets them produce it.
Ramp: spot the vague result → type exact words → ask with exact words.
```

```
Task: in-and-out · "In and out"          Type: core (make)
Success: "Rex eats the food you type." (6)
One idea: a clear ask says what goes in (what you type) and what comes out (what Rex says).
Misconception fixed: "feed the pet" is clear. Bolt cannot know who types what, or what Rex answers.
Story: Feed Rex. He tells you what he ate.
Starter: print("Yum")
Steps:
  1. stage:machine — discover — prompt "Put cake in. Get cakecake! out." (6)
     config { input: "cake" }, goal { out: "cakecake!" }.
     Palette: '* 2' (double) · '+ "!"' (exclaim) · '.upper()' (upper). Solution [0, 1].
     Weeks 1–5 already use the machine for hello → HELLO!, hi → HI! and numbers. This one uses
     `* 2` on a string, which no earlier machine solution does (week 1 has it only as a wrong
     block). The point is also new: name what goes in and what comes out before you ask.
     The student understands in → change → out because they push cake through and watch the result.
  2. learn (3 frames) — name it — prompt "Say what goes in. Say what comes out." (8)
     'food = input("Food? ")'                     "In: you type a food." (5)
     'print("Yum, " + food)'                      "Out: Rex says Yum and it." (6)  speak "Yum, cake"
     '# ask: I type a food. Rex says Yum + food'  "Your ask says in and out." (6)
Editor: go = "Ask for a pet you can feed. Say what goes in and out." (13)
  checks = the code uses input() (static) · with "cake" typed, Rex's answer has cake
           (output, inputs ["cake"], flags i) · ask() × 1 · NOTE × 2.
Why not walk: a walk only replays a run and shows no typing. The machine shows in → out as a thing.
Ramp: push a value through → name in and out → ask with both.
```

```
Task: small-pieces · "Small pieces"      Type: core (make)
Success: "Two small pieces, joined by you." (6)
One idea: Bolt builds small pieces only (8 lines). Ask one piece at a time, then join them yourself.
Misconception fixed: "one big ask is best" / "the AI should do it all at once".
Story: Rex needs a name and a mood. Ask for each one.
Starter: name = "Rex"      (prints nothing, so the output check fails on it)
Steps:
  1. choose — hook — prompt "Which ask can Bolt build?" (5)
     options 'A whole pet game' · 'Rex says his mood' · 'Rex with 10 tricks', answer 1.
     explain "Bolt writes 8 lines at most. Ask small." (8)
     The student understands the size limit because they must pick the one ask that fits.
  2. match — one ask, one piece — prompt "Tap a piece. Tap the ask for it." (8)
     'name = "Rex"'              ↔ "Give the pet a name" (5)
     'mood = name + " is happy"' ↔ "Make Rex happy" (3)
     'print(mood)'               ↔ "Rex says his mood" (4)
     The student understands one small ask makes one piece because they pair each piece with its ask.
  3. order — join them — prompt "Join the pieces. Tap them in order." (7)
     'name = "Rex"' · 'mood = name + " is happy"' · 'print(mood)'
     Each line needs the one before it, so there is exactly one right order (order grading is exact).
     The student understands joining is their job, and order matters, because they build the
     working program from the pieces.
Editor: go = "Ask Bolt for 2 small pieces. Join them. Write both asks." (11)
  checks = ask() × 2 ("One # ask: line for each piece.") · Rex says 3 different lines (output,
           the intro-3 pattern) · NOTE × 3.
Note: Bolt's "too big" reply only shows when it cannot fit 8 lines after 2 retries. Usually it just
  squeezes the code. So the steps teach the limit in words, and nothing depends on seeing the refusal.
Why not a stage: no scene joins two programs. `order` is exactly "put the pieces together".
Ramp: pick the small ask → pair ask and piece → join the pieces → do it with Bolt.
```

```
Task: pet-game · "Boss: Pet game"        Type: core (make), boss
Success: "Your pet game runs, explained by you." (7)
One idea: put it together. Ask for 2–3 pieces (name, mood, food), join them, explain each main line.
Misconception fixed: "pasted pieces just work together" and "a note that reads the code aloud
  explains it".
Story: Rex's game: he has a name and a mood, and you feed him.
Starter: name = "Rex"
Steps:
  1. bug — the join trap — prompt "Two pieces, joined. Tap the line that breaks." (8)
     code 'name = "Rex"\nprint(name + " ate " + food)\nfood = input("Food? ")', bugLine 1.
     explain "food comes later. Move it up." (6)
     The student understands pieces must be joined in the right order because they find the crash.
  2. choose — rule 4 — prompt "Which note explains it best?" (5), code 'print("Yum, " + food)'
     options '# print Yum plus food' (5) · '# Rex thanks me for food' (6) · '# a print' (3), answer 1.
     explain "A good note says why, in your words." (8)
     The student understands a note must say what the line does for Rex, not read the code aloud,
     because they reject the note that repeats it. This is what Sparky will look for.
Editor: go = "Ask Bolt for 2 or 3 pieces: name, mood, food. Join them. Explain each." (14)
  checks = ask() × 2 · the code uses input() (static) · with "cake" typed, Rex's answer has cake
           (output, inputs ["cake"]) · Rex says 3 different lines (output, inputs ["cake"]) ·
           NOTE × 4 ("Add a # note on each main line.").
Why two steps: bosses in weeks 4–7 use 2 short steps. The editor is the real work.
Ramp: fix the join → pick the real note → build and explain the whole game.
```

```
Task: pet-trick · "Pet trick"            Type: choice (make)
Success: "Rex does your trick." (4)
One idea: you choose the trick and say it exactly. Bolt builds only that trick.
Misconception fixed: "do a trick" gets a cool trick. It gets "trick".
Starter: name = "Rex"
Steps:
  1. match — prompt "Tap an ask. Tap what Bolt builds." (7)
     '# ask: Rex jumps 3 times' ↔ "Says jump jump jump" (4)
     '# ask: Rex spins once'    ↔ "Says spin once" (3)
     '# ask: Rex does a trick'  ↔ "Says trick. That is all." (5)
     The student understands the exact ask decides the trick because the vague ask pairs with a
     useless result.
Editor: go = "Pick one trick for Rex. Ask Bolt for just that." (10)
  checks = runs · NOTE × 1 · ask() × 1 (decision 3).
Why one step: a choice task is optional, and week 7's choice task used 2 short steps. The trick is
  the student's own idea, so the editor carries it.
```

```
Task: hw-my-pet · "My own pet"           Type: bonus (make). No steps.
Success: "Your own pet runs." (4)
Your own pet, start to finish: your asks, Bolt's pieces, joined and explained by you.
Starter: empty.
checks = Rex says 3 different lines (output) · NOTE × 3 · ask() × 1 (decision 3).
```

```
Task: hw-better-ask · "Better request"   Type: bonus (change)
Success: "The weak ask got better." (5)
One idea: find what a weak ask leaves out, and write it better.
Starter: print("stuff")    (what Bolt built from the weak ask; the ask itself is only in the step)
Steps:
  1. bug — prompt "A friend wrote this ask. Tap the weak line." (8)
     code '# ask: my pet does stuff\nprint("stuff")', bugLine 0.
     explain "Say the words, not stuff." (5)
     The student understands the weak result comes from the weak ask because they tap the ask,
     not the print.
Editor: go = "Write a better ask. Say the name, the words and a number." (12)
  checks = Rex says more than "stuff": a printed line of 2+ words that is not "stuff" (output)
           · NOTE × 1 · ask() × 1 (decision 3).
The weak request lives in the step, not in the starter (requirements, carry-forward 2).
```

```
Task: hw-bug-pet · "Fix the crash"       Type: bonus (bugzap), in bugzap.py. No steps.
Success: "bugzap.py finishes." (2)
Story (in the task prompt Sparky reads, not in a comment): someone asked Bolt "Rex says Rex is and
  his age". Bolt built exactly that, and it crashes.
Starter (py/w8-bugzap.py), the anchor is its only comment:
  # TASK: hw-bug-pet
  age = 3
  print("Rex is " + age)
  print("Pet done!")
It crashes with TypeError: text and a number cannot be added. Fix with str(age) or an f-string.
checks = bugzap.py says done (output, file bugzap.py, "Read the last line of the red text.")
         · NOTE × 1 ("Add a # note on the line you fixed.").
```

## Notes for later groups

- **Task 9 is not its own program.** `taskFile` returns `bugzap.py` for it, so it uses the
  `task()` default (`commentAnchor: 'TASK: hw-bug-pet'`), like week 7's `hw-bug-key`. The plan's
  "9 tasks, each its own program" means tasks 1–8. Its NOTE check still runs on `bugzap.py`,
  because the task page's code node holds that file. Unlike week 7's bugzap, there is no
  `# BUG ZAP:` header.
- **Risk for group 4 and the browser check: Bolt copying `# ask:`.** Bolt sees the student's code
  and may copy lines from it. If it copies the `# ask:` line, the comment guard sends it back.
  If it keeps copying, the student gets `BOLT_FAILED`. A possible fix is one line in `BOLT_PROMPT`
  ("never copy comment lines") or stripping full-line comments from the code Bolt is shown. Watch
  for it in the browser check.
- The `NOTE` pattern counts only a note after code on the same line, so `# ask:` never counts as a
  note, and a full-line comment never does either.

## Decisions (were open questions)

1. **Task ids** (they freeze on merge): make-pet, exact-words, in-and-out, small-pieces, pet-game,
   pet-trick, hw-my-pet, hw-better-ask, hw-bug-pet.
2. **`ask()` strictness.** A `# ask:` line with at least 3 words after it, so `# ask: pet` alone
   fails. Clarity stays Sparky's call. No static "words in quotes" check on tasks 2 and 8: a clear
   ask without quote marks would be refused and could dead-end a child. Sparky asks for exact
   words instead.
3. **`# ask:` on the optional tasks.** `ask()` is on every core task and also on 6, 7 and 8, which
   are about asking. Not on 9, which is about fixing.
4. **Starters show Bolt's literal result** (`print("pet")` on task 1, `print("stuff")` on task 8),
   with no comment. The `go` line or step says where each came from.
5. **Note counts**: 1 · 2 · 2 · 3 · 4 on the core tasks, 1 · 3 · 1 · 1 on tasks 6–9.

## Check copy as built (group 3)

The `notes` and `# ask:` checks add 29 labels and hints to one week, so the first draft read at 430
words and broke the course's total reading budget (`lesson-copy.test.ts`: under 300 words per
lesson in total). The check copy was shortened to fit (374 words; 2391 of 2400 for the course):

| Check                | Label                                        | Hint                                     |
| -------------------- | -------------------------------------------- | ---------------------------------------- |
| `ask()` × 1          | You wrote # ask:                             | Write # ask: then your words.            |
| `ask()` × 2          | You wrote 2 asks                             | One # ask: per piece.                    |
| `notes()` × 1        | You added a # note                           | After a line: # and your words.          |
| `notes()` × 2        | You added 2 # notes                          | After each line: # and your words.       |
| `notes()` × 3 / 4    | You added 3 # notes / You added 4 # notes    | Each main line: # and your words.        |
| task 9 `notes()`     | You added a # note                           | Add a # note on your fix.                |
| food (tasks 3, 5)    | Rex says your food                           | Print the food you typed.                |
| 3 lines (tasks 4, 5) | Rex says 3 lines (still 3 _different_ lines) | Three different lines. Join your pieces. |

The course is now 9 words under its budget, so the next copy edit that adds words anywhere will
fail CI. Weeks 9–12 raise the budget by 300 words each.
