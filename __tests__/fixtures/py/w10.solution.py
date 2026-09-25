# TASK: party-goal
# goal: Rex says welcome to his party
print("Welcome to my party!")  # Rex says hi

# TASK: party-invite
# goal: Rex invites 3 friends to his party
# done: I see 3 invites
print("Tom, come to my party!")  # invite 1
print("Ana, come to my party!")
print("Sam, come to my party!")

# TASK: party-snacks
# goal: Rex shows his snacks and how many
# step: make a list of snacks
# step: print each snack
# step: print how many
# done: I see 3 snacks, then 3
snacks = ["cake", "fish", "bone"]
for snack in snacks:
    print(snack)  # one snack
print(len(snacks))

# TASK: party-game
# goal: Rex plays a number game
# step: ask for a number
# step: say win if it is 7
# done: I type 7 and see You win
n = int(input("Number? "))
if n == 7:
    print("You win!")  # the magic number
else:
    print("Try again")

# TASK: party-show
# goal: Rex does a show with 3 tricks
# step: Rex does 3 tricks
# step: Rex says Bye
# done: I see 3 tricks, then Bye
# ask: print sit, spin, jump, then Bye
for trick in ["sit", "spin", "jump"]:
    print(trick)  # one trick
print("Bye!")  # show ends

# TASK: plan-for-bolt
# goal: Rex sings a party song
# done: I see la la la
# ask: print la la la on one line
print("la la la")  # the song

# TASK: hw-cake
# goal: Rex counts down to cake
# step: count 3, 2, 1
# step: Rex says Cake
# done: I see 3, 2, 1, then Cake
for n in range(3, 0, -1):
    print(n)  # count down
print("Cake!")

# TASK: hw-gifts
# goal: each friend gets a gift
# step: put friends and gifts in a dict
# step: print who gets what
# done: I see Tom gets ball, Ana gets cake
gifts = {"Tom": "ball", "Ana": "cake"}
for name in gifts:
    print(name, "gets", gifts[name])  # one gift
