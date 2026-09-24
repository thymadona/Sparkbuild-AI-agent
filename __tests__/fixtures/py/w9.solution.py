# TASK: feed-rex
# bug: at 10 Rex waited, but 10 biscuits is enough to eat
def feed(biscuits):
    if biscuits >= 10:  # ten counts as enough now
        return "Rex eats"
    return "Rex waits"

print(feed(12))
print(feed(10))

# TASK: trick-count
# bug: tricks(3) gave only 2 jumps, it should give 3
def tricks(n):
    done = []
    for i in range(n):  # runs n times, not one less
        done.append("jump")
    return done

print(tricks(3))

# TASK: empty-bowl
# bug: bowl(0) said None, an empty bowl should say empty
def bowl(biscuits):
    if biscuits > 5:
        return "full"
    if biscuits > 0:
        return "some"
    return "empty"  # nothing left in the bowl

print(bowl(8))
print(bowl(3))
print(bowl(0))

# TASK: just-asked
# bug: Rex gave away a snack per friend and I never asked
def visit(friends, snacks):
    for friend in friends:
        print("Hi " + friend)  # Rex greets each friend
    return snacks

left = visit(["Mia", "Sam"], 5)
print("Rex has", left, "snacks")

# TASK: rex-check
# bug: 3 tricks gave a small snack, 3 should get big
# bug: 0 tricks gave None, it should say none
def snack(tricks):
    if tricks >= 3:  # three tricks earn the big one
        return "big"
    if tricks > 0:
        return "small"
    return "none"  # no tricks means no treat

print(snack(5))
print(snack(3))
print(snack(0))

# TASK: ask-and-check
# ask: Rex says jump 3 times
for i in range(3):  # three jumps for Rex
    print("jump")
# bug: none, it said jump 3 times like I asked

# TASK: hw-rex-diary
# bug: the diary said Rex ate the ball, he ate cake
def diary(food, toy):
    return "Rex ate " + food + " and played with " + toy  # food first, then the toy

print(diary("cake", "ball"))

# TASK: hw-bolt-right
# bug: none, 9 says no and 10 says yes like the rule
def walker(age):
    if age >= 10:
        return "yes"
    return "no"

print(walker(12))
print(walker(10))  # the border age
print(walker(9))
