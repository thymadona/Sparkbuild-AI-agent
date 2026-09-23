# Week 7 — Monster Dex: task-design sketch

**Status: approved by the owner (2026-09-23), open questions answered as proposed.** Plan group 2.

Story: Sparky keeps a **Monster Dex**, a dict of monster name → power. The student grows it,
looks up unknown monsters safely, counts sightings, groups monsters by type and writes the report.

Starter data in `main.py` (one `# TASK:` block each, variable names kept apart so tasks can't clash):

| Task    | Data in its block                                                                      |
| ------- | -------------------------------------------------------------------------------------- |
| 1, 2, 6 | `dex = {"slime": 2, "bat": 5, "golem": 9}` (top of file, shared)                       |
| 3       | `sightings = ["bat", "imp", "bat", "slime", "bat"]`, `seen = {}`                       |
| 4       | `types = {"fire": ["imp"], "ice": ["yeti"]}`                                           |
| 5       | `log = [...]`, 8 sightings, most seen `ghost` (a name used nowhere else), `tally = {}` |

Step types used across the week (week 6 ended with `learn choose` on `shrink`):

| #   | Task                                  | Steps                                               |
| --- | ------------------------------------- | --------------------------------------------------- |
| 1   | new-monster                           | stage:boxes · learn · choose                        |
| 2   | unknown-monster                       | bug · learn · match                                 |
| 3   | count-sightings                       | stage:boxes · learn · order                         |
| 4   | monster-types                         | learn · walk · bug                                  |
| 5   | dex-report (boss)                     | choose · bug                                        |
| 6   | release                               | learn · match                                       |
| 7–9 | hw-my-dex, hw-explain-dex, hw-bug-key | none (homework, like the `hw-*` tasks in weeks 4–6) |

No step type appears twice in a row. `learn` shows up in most tasks, which is the house pattern
(it names the idea after the student has seen it). `choose` appears twice, both times aimed at a
real misconception.

---

```
Task: new-monster · "New monster"        Type: core (change)
One idea: dex[name] = value makes a new box if the name is new, and changes it if not.
Misconception fixed: "a dict is fixed once written" / "dex["bat"] + 1 changes bat by itself".
Story: Sparky spots a new monster, an imp. The bat levels up.
Steps:
  1. stage:boxes — hook/discover — config slime=2, bat=5; goal imp=3, bat=6.
     Palette: dex["imp"] = 3 (set:imp=3) · dex["bat"] = dex["bat"] + 1 (add:bat:1) ·
     dex["bat"] = 1 (set:bat=1, the "replace, not add" trap). Solution [0, 1].
     The student understands a new key makes a new box because they watch it appear (group 1).
  2. learn (2 frames) — name it — 'dex["imp"] = 3' "New name? New box." ·
     'dex["bat"] = dex["bat"] + 1' "Old name? Its box changes."
  3. choose — check — dex = {"bat": 5}; dex["imp"] = 3; dex["bat"] = 6; print(len(dex))
     options 2 / 3 / 1, answer 2. "bat was changed, not added."
     The student understands the old key is replaced, not doubled, because they must count boxes.
Editor: go = "Add a new monster. Level up the bat."
  checks = a line sets a key that is not in the starter (static, the regex leaves out slime/bat/golem) ·
           a line grows a value from itself (dex["bat"] = dex["bat"] + 1 or +=) · runs.
Why not walk: the boxes stage shows the same state change and lets the student act.
Ramp: see it (stage) → name it → predict it → type it.
```

```
Task: unknown-monster · "Unknown monster"   Type: core (change)
One idea: asking for a missing key crashes, so ask first with in, or use .get().
Misconception fixed: "a missing key just gives nothing / 0".
Story: Someone asks Sparky about a yeti. It is not in the dex.
Steps:
  1. bug — hook — 'dex = {"bat": 5}\nprint(dex["bat"])\nprint(dex["yeti"])', bug line 2,
     "yeti is not in the dex. KeyError!"
     The student understands a missing key crashes because they find the exact line.
  2. learn (2 frames) — two safe ways — 'if "yeti" in dex:' "Ask first. True or False." ·
     'dex.get("yeti", 0)' "Not there? You get 0." (speak: "0")
  3. match — own the words — dex["yeti"] ↔ "Crash if missing" · "yeti" in dex ↔ "True or False" ·
     dex.get("yeti", 0) ↔ "0 if missing".
Editor: go = "Look up the yeti. Ask first so it does not crash."
  checks = the code asks about "yeti" with in or .get (static) · runs (no crash).
  The starter does not contain the crash itself, so tasks 1 and 3–6 still run while the student
  works. The real crash lives in bugzap.py (task 9).
Why not a stage: the boxes scene cannot crash, so it would teach the wrong thing about missing keys.
Ramp: spot the crash → see the fix → match the forms → write it.
```

```
Task: count-sightings · "Count sightings"   Type: core (make)
One idea: to count, add 1 to a name's box each time you see it, starting from 0.
Misconception fixed: seen[name] = 1 every time (resets), or seen[name] += 1 on a new name (KeyError).
Story: Sparky writes down each monster it sees. How many of each?
Steps:
  1. stage:boxes — discover — prompt "Sparky saw: bat, imp, bat. Count them." Config: no boxes.
     Goal bat=2, imp=1. Palette: seen["bat"] = seen.get("bat", 0) + 1 (add:bat:1) ·
     seen["imp"] = seen.get("imp", 0) + 1 (add:imp:1) · seen["bat"] = 1 (set:bat=1, the reset trap).
     Solution [0, 1, 0].
     The add blocks carry the .get(…, 0) code on purpose. The scene's add starts a missing box at 0,
     and that is what .get does in Python (a bare += would crash). This keeps the board honest.
     The student understands a tally because they see each sighting bump one box, and new boxes pop up.
  2. learn (2 frames) — name it in a loop — 'for name in sightings:' "One sighting at a time." ·
     'seen[name] = seen.get(name, 0) + 1' "Start at 0. Add 1."
  3. order — build it — seen = {} · for name in sightings: · seen[name] = seen.get(name, 0) + 1 ·
     print(seen). Order matters here: seen = {} inside the loop would wipe the count.
Editor: go = "Count every sighting. Print seen."
  checks = a for loop over sightings (static) · seen["bat"] == 3 (calls, after load) · runs.
  The if name in seen: … else: … form also passes.
Why not choose: the stage already tests prediction by doing it.
Ramp: tally by hand (stage) → name the line → put the loop in order → write it.
```

```
Task: monster-types · "Monster types"     Type: core (make)
One idea: a key can hold a list, so you can append to the list inside.
Misconception fixed: types.append("drake") (appending to the dict, not the list under the key).
Story: Sparky sorts monsters into fire and ice.
Steps:
  1. learn (2 frames) — hook — 'types = {"fire": ["imp"]}' "A key can hold a list." ·
     'types["fire"].append("drake")' "Open the fire list. Add one."
  2. walk — see it run — about 4 lines: make types, append to fire, append to ice, print(types["fire"]).
     Frames show the types repr growing and the output.
     Limit: the trace cuts a repr at 40 characters, so keep names short (imp, yeti, bat…).
     The walk test checks the frames against a real run.
     The student understands the list lives inside the key because they watch only that part grow.
  3. bug — fix thinking — 'types = {"fire": ["imp"]}\ntypes.append("drake")\nprint(types)', bug line 1,
     "Pick the list first: types["fire"]."
Editor: go = "Add a monster to fire. Print each type and its monsters."
  checks = an .append on types[...] (static) · len(types["fire"]) == 2 (calls) ·
           a loop with .items() (static) · runs.
Why not a stage: boxes hold one value, not a list, and the plan picks walk for this task.
Ramp: see the shape → watch it grow → spot the wrong append → write it.
```

```
Task: dex-report · "Boss: Dex report"     Type: core (make), boss
One idea: put it together. Count, find the most-seen monster, print the total.
Misconception fixed: max(tally) gives the most-seen monster (it gives the last name in ABC order).
Story: The day is over. Sparky reads the Dex report.
Steps:
  1. choose — trap — 'tally = {"bat": 3, "slime": 1}\nprint(max(tally))' options slime / bat / 3,
     answer slime. "max looks at names, not counts."
  2. bug — the loop trap — 'top = 0\nfor name, n in tally.items():\n    if n < top:\n        top = n',
     bug line 2, "Keep the bigger one: n > top."
Editor: go = "Count the log. Print the most seen monster and the total."
  checks = output names ghost next to most/top/best (output, flags i) ·
           output says the total 8 next to a word like total/all/seen (output) ·
           a loop with .items() (static).
  ghost appears only in this block, so earlier tasks' prints cannot pass it by accident.
Why two steps: bosses in weeks 4–6 use 2 short steps. The editor is the real work.
Ramp: dodge the trap → fix the compare → build the whole report.
```

```
Task: release · "Release a monster"       Type: choice (change)
One idea: del dex[name] or dex.pop(name) takes a key out.
Misconception fixed: dex.remove("slime") (a list method, dicts do not have it).
Story: The slime wants to go home.
Steps:
  1. learn (2 frames) — 'del dex["slime"]' "The slime box is gone." ·
     'dex.pop("slime")' "Gone, and you get its power back." (speak: "2")
  2. match — del dex["slime"] ↔ "Box is gone" · dex.pop("slime") ↔ "Gone, gives back 2" ·
     dex.remove("slime") ↔ "Crash: dicts have no remove".
Editor: go = "Let the slime go. Print the dex."
  checks = "slime" not in dex (calls) · runs.
Why not boxes: the scene has no remove op, and the non-goals rule out a scene change.
Ramp: see → match → do.
```

```
Task: hw-my-dex · "My dex"                Type: bonus (make). No steps.
Build your own dict of 5 monsters and print one by name.
checks = a dict with 5 pairs (static, like hw-shopping) · runs.
```

```
Task: hw-explain-dex · "Explain the dex"  Type: bonus (explain). No steps.
The starter has 3–4 lines (a lookup, a .get, a del or +1, a print). Add a # note on each.
checks = NOTE × 3 (static, like hw-comment).
```

```
Task: hw-bug-key · "Fix the crash"        Type: bonus (bugzap), in bugzap.py. No steps.
Starter: dex = {"slime": 2, "bat": 5} · print(dex["slime"]) · print(dex["Bat"]) · print("Dex done!")
It crashes with KeyError: 'Bat'. Keys must match exactly, big letters too.
checks = bugzap.py says done (output, file bugzap.py).
```

## Decisions (were open questions)

1. **Task 3 counting line.** The week teaches `seen[name] = seen.get(name, 0) + 1` as the counting
   line, so the boxes stage matches Python. The `if name in seen` form still passes the checks.
   Is `.get` fine as the main form, or do you want `if … in … else` to lead?
2. **Homework tasks without steps.** This matches weeks 4–6. Should `hw-my-dex` get a step anyway?
3. **Task ids** (they freeze after merge): new-monster, unknown-monster, count-sightings,
   monster-types, dex-report, release, hw-my-dex, hw-explain-dex, hw-bug-key.
