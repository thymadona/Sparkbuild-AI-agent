// Starter programs for the Python course, keyed by the path a lesson names in `templateFile`/`extraFiles`.
// Server-side only: the server seeds a project from these, so the browser never supplies (or can
// forge) a starter, and students cannot fetch the untouched files from /templates.

export const TEMPLATES: Record<string, string> = {
  'py/w1-bugzap.py': `# BUG ZAP: this program crashes. Find the mistake and fix it.
# Press Run and read the last line of the red text.

# TASK: hw-bug-quote
print("Sparky is waking up...)
print("Sparky is ready!")
`,
  // Week 1's tasks each carry their own starter (lib/py-lessons.ts); this is just the file's header.
  'py/w1.py': `# WEEK 1: Wake the Robot\n# Sparky is asleep. Press Run and watch: Sparky says every line you print.\n`,
  'py/w2-bugzap.py': `# BUG ZAP: Sparky's door never opens, even with the right code.
# Press Run and read the last line of the red text.

# TASK: hw-bug-equals
secret = 42
guess = 42
if guess = secret:
    print("Door open!")
else:
    print("Door locked!")
`,
  'py/w2.py': `# WEEK 2: The Number Vault
# Sparky guards a vault. You write the rules for the door.
# Sparky's tools: sparky.open_door()  sparky.close_door()  sparky.alarm()
import sparky

# TASK: vault-math
# Guess first! Write your guess after the colon. Then press Run.
# guess:
coins = 50
price = 12
print(coins + price)
# Try -  *  /  //  and %  too.

# TASK: true-false
# Compare two things. The answer is True or False.
# guess:


# TASK: door-lock
# The door opens only for the secret code.
# Use if and else. Change guess to test both doors.
secret = 1234
guess = 1234


# TASK: three-doors
# Add a third door in the middle with elif.


# TASK: vault-guard
# BOSS: open, closed, or ALARM.
# One rule must use < or >. Sound the alarm when the guess is way off.


# TASK: and-or
# SIDE QUEST: use and, or or in one rule.


# TASK: even-odd
# BONUS: print even or odd. Hint: coins % 2


# TASK: hw-discount
# BONUS: totals over 50 get a discount.
total = 80
`,
  'py/w3-bugzap.py': `# BUG ZAP: the countdown is broken. Find two mistakes.
# Press Run and read the red text. If it never stops, press Stop.

# TASK: hw-bug-loop
count = 3
while count > 0
    print(count)
print("Liftoff!")
`,
  'py/w3.py': `# WEEK 3: The Repeat Reactor
# The reactor needs a countdown and a code lock. A loop repeats work for you.

# TASK: count-down
# Guess first! How many lines print? Write it after the colon.
# guess:
for i in range(3):
    print(i)
# Change the number in range() so Sparky counts up to 3.

# TASK: times-table
# Count by 2s: 2, 4, 6 ... Use range(start, stop, step).


# TASK: hold-line
# Make a counter. Repeat with while. Use break to stop at 3.


# TASK: ask-repeat
# Ask for a number with input(). Say hello that many times.


# TASK: guess-number
# BOSS: the secret is 7. Loop until the guess is right.
# Say Higher or Lower after each wrong guess. Keep secret = 7.
secret = 7


# TASK: stars
# SIDE QUEST: print a star triangle. Hint: "*" * 3


# TASK: total
# BONUS: add up 1 to 100 with a loop. Print the total.


# TASK: hw-countdown
# BONUS: count down from 5 to 1. Then print a launch message.


# TASK: hw-explain
# BONUS: add a # note after each line of this loop.
for n in range(2):
    print("Reactor", n)
`,
  'py/w4-bugzap.py': `# BUG ZAP: this loop crashes with an IndexError.
# Press Run and read the last line of the red text.

# TASK: hw-bug-index
fruits = ["apple", "pear", "plum"]
for i in range(4):
    print(fruits[i])
print("Basket done!")
`,
  'py/w4.py': `# WEEK 4: The Inventory Raid
# Raid the dungeon! Your backpack is a list. Item powers live in a dict.

# TASK: backpack
# Guess first! What is the last item? Write it after the colon.
# guess:
backpack = ["sword", "map", "torch"]
print(backpack[0])
print(len(backpack))
# Print the last item too. Hint: backpack[-1]

# TASK: loot-loop
# Use a for loop to print every item in your backpack.


# TASK: grab-drop
# Grab a potion with append. Drop the map with remove.
# Check first with: if "map" in backpack:


# TASK: item-stats
# A dict pairs a name with a power: {"sword": 5}
# Make one. Loop with: for name, power in stats.items():


# TASK: loot-report
# BOSS: print the total power, the best item and how many items.
loot = {"sword": 5, "shield": 3, "bow": 4}


# TASK: sort-loot
# SIDE QUEST: print your backpack in ABC order. Hint: sorted()


# TASK: trade
# BONUS: trade away the last item with pop(). Print what you traded.


# TASK: hw-shopping
# BONUS: make a shopping list of 5 things. Loop over it.


# TASK: hw-comment
# BONUS: add a # note after each print line.
prices = {"apple": 2, "kiwi": 3}
print(prices["apple"])
print(prices["kiwi"])
print(len(prices))
`,
  'py/w5-bugzap.py': `# BUG ZAP: this spell should print 10, but it prints None.
# Press Run. Why does the spell give nothing back?

# TASK: hw-bug-return
def double_damage(power):
    result = power * 2

print(double_damage(5))
`,
  'py/w5.py': `# WEEK 5: The Spell Book
# Spells are functions. Write a spell once, then cast it again and again.

# TASK: first-spell
# Make a spell with def. It should print something. Then cast it.
# Example: def cast():


# TASK: target-spell
# Give a spell a target. Use a parameter: def zap(target):


# TASK: damage
# Write damage(power). It must return power * 2.


# TASK: dice
# Roll a dice with random.randint(1, 6). Print the roll.


# TASK: battle-round
# BOSS: the monster has 20 HP. Use damage() in a while loop.
# Hit it until its HP is 0. Then say it is defeated.
monster_hp = 20


# TASK: heal
# SIDE QUEST: write heal(hp, amount). It returns hp + amount.


# TASK: crit
# BONUS: inside a spell, roll 1 to 10. Above 8 is a CRIT!


# TASK: hw-shield
# BONUS: write shield(dmg). It returns half of dmg.


# TASK: hw-explain
# BONUS: add a # note after each line of this code.
hp = 10
hp = hp - 3
print("HP:", hp)
`,
  'py/w6.py': `# WEEK 6: Bug Hunt
# The Robot Factory is glitching! Fix it and graduate.
# Method: Read the error, guess why, test with print, fix, run again.
# Press Run. Fix the first crash you see. Then run again.

# TASK: read-crash
# This report crashes. Read the last line of the red text.
def battery_report():
    return "Battery level: " + str(battery)


# TASK: three-bugs
# Three bugs hide here. Robots should say 3. Total power should say 15.
robots = ["Sparky", "Bolt", "Gizmo"]
powers = [5, 7, 3]


def robot_count():
    return len(robots) + 1


def total_power():
    total = 0
    for i in range(1, len(powers)):
        total = total + powers[i]
    return total - 1


# TASK: detective
# Guess first! What will this print? Write it after the colon.
# guess:
x = 3
y = x * 2
x = y + 1
print(x, y)


# TASK: catch-ai
# The AI wrote average(a, b). It looks right. Is it? Test it, then fix it.
def average(a, b):
    return a + b / 2


# TASK: factory-rescue
# BOSS: 4 bugs hide here. Fix them all until every test passes.
crew = [
    {"name": "Sparky", "power": 5},
    {"name": "Bolt", "power": 7},
    {"name": "Gizmo", "power": 8},
]


def crew_power(team):
    total = 0
    for robot in team:
        total = robot["power"]
    return total


def strongest(team):
    best = team[0]
    for robot in team:
        if robot["power"] < best["power"]:
            best = robot
    return best["name"]


def robot_names(team):
    names = []
    for robot in team:
        names.append(robot["name"])
    print(names)


def count_robots(team):
    return len(team) - 1


def run_tests():
    assert crew_power(crew) == 20
    assert strongest(crew) == "Gizmo"
    assert robot_names(crew) == ["Sparky", "Bolt", "Gizmo"]
    assert count_robots(crew) == 3
    return "All tests passed!"


# TASK: shrink
# SIDE QUEST: this makes 3 beeps the long way. Use one for loop.
print("Beep 1")
print("Beep 2")
print("Beep 3")


# TASK: plant-bug
# BONUS: write a tiny program with one hidden bug for a friend.
# Then add a note that starts with: bug:


# TASK: hw-bug-crash
# BONUS: greet crashes. Read the last line of the red text.
def greet(name):
    return "Hello " + name + 1


# TASK: hw-report
# BONUS: write a bug report. Fill in the three notes.
# error:
# expected:
# got:


# The factory runs here. Leave this part as it is.
if __name__ == "__main__":
    print(battery_report())
    print("Robots:", robot_count())
    print("Total power:", total_power())
    print(average(4, 8))
    print(run_tests())
    print(greet("Sparky"))
`,
  'py/w7-bugzap.py': `# BUG ZAP: this dex crashes with a KeyError.
# Press Run and read the last line of the red text.

# TASK: hw-bug-key
dex = {"slime": 2, "bat": 5}
print(dex["slime"])
print(dex["Bat"])
print("Dex done!")
`,
  'py/w7.py': `# WEEK 7: Monster Dex
# Sparky keeps a Monster Dex. A dict pairs each monster with its power.

# TASK: new-monster
dex = {"slime": 2, "bat": 5, "golem": 9}
print(dex["bat"])
# Add a new monster: dex["imp"] = 3
# The bat levels up. Add 1 to its power.


# TASK: unknown-monster
# Is there a yeti in the dex? dex["yeti"] would crash!
# Ask first with in, or use .get(). Print what you find.


# TASK: count-sightings
# Sparky saw these monsters today. Count each one in seen.
sightings = ["bat", "imp", "bat", "slime", "bat"]
seen = {}


# TASK: monster-types
# Each type holds a list of monsters.
types = {"fire": ["imp"], "ice": ["yeti"]}
# Add "drake" to the fire list. Print each type and its monsters.


# TASK: dex-report
# BOSS: count the log in tally.
# Print the most seen monster and the total.
log = ["ghost", "bat", "ghost", "imp", "ghost", "bat", "ghost", "slime"]
tally = {}


# TASK: release
# SIDE QUEST: the slime wants to go home. Take it out of the dex.


# TASK: hw-my-dex
# BONUS: make your own dex with 5 monsters. Print one by its name.


# TASK: hw-explain-dex
# BONUS: add a # note after each print line.
eggs = {"dragon": 1, "phoenix": 2}
print(eggs["dragon"])
print(eggs.get("griffin", 0))
print(len(eggs))
`,
  // Week 8 is a director week: Bolt reads the student's code, so no starter comment may state
  // the goal (only the bugzap anchor). Each task carries its own starter (lib/py-lessons.ts).
  'py/w8.py': '',
  'py/w8-bugzap.py': `# TASK: hw-bug-pet
age = 3
print("Rex is " + age)
print("Pet done!")
`,
}

export function templateFor(file: string): string {
  const src = TEMPLATES[file]
  if (src === undefined) throw new Error(`Unknown lesson template: ${file}`)
  return src
}
