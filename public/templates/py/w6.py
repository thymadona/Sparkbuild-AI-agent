# WEEK 6: Bug Hunt
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
# HOMEWORK: greet crashes. Read the last line of the red text.
def greet(name):
    return "Hello " + name + 1


# TASK: hw-report
# HOMEWORK: write a bug report. Fill in the three notes.
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
