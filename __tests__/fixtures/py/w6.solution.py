battery = 90


def battery_report():
    return "Battery level: " + str(battery)


robots = ["Sparky", "Bolt", "Gizmo"]
powers = [5, 7, 3]


def robot_count():
    return len(robots)


def total_power():
    total = 0
    for i in range(len(powers)):
        total = total + powers[i]
    return total


# guess: 7 6
x = 3
y = x * 2
x = y + 1
print(x, y)


def average(a, b):
    return (a + b) / 2


crew = [
    {"name": "Sparky", "power": 5},
    {"name": "Bolt", "power": 7},
    {"name": "Gizmo", "power": 8},
]


def crew_power(team):
    total = 0
    for robot in team:
        total = total + robot["power"]
    return total


def strongest(team):
    best = team[0]
    for robot in team:
        if robot["power"] > best["power"]:
            best = robot
    return best["name"]


def robot_names(team):
    names = []
    for robot in team:
        names.append(robot["name"])
    return names


def count_robots(team):
    return len(team)


def run_tests():
    assert crew_power(crew) == 20
    assert strongest(crew) == "Gizmo"
    assert robot_names(crew) == ["Sparky", "Bolt", "Gizmo"]
    assert count_robots(crew) == 3
    return "All tests passed!"


for i in range(1, 4):
    print("Beep", i)

# bug: the loop below skips the number 0


def greet(name):
    return "Hello " + name


# error: TypeError on the greet line
# expected: Hello Sparky
# got: a red error


if __name__ == "__main__":
    print(battery_report())
    print("Robots:", robot_count())
    print("Total power:", total_power())
    print(average(4, 8))
    print(run_tests())
    print(greet("Sparky"))
