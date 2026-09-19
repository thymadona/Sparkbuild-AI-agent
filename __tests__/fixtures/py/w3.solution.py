# guess: 3
for i in range(4):
    print(i)

for n in range(2, 12, 2):
    print(n)

count = 0
while True:
    count += 1
    print("Reactor", count)
    if count == 3:
        break

times = int(input("How many times? "))
for i in range(times):
    print("Hello Sparky!")

secret = 7
while True:
    guess = int(input("Guess: "))
    if guess < secret:
        print("Higher!")
    elif guess > secret:
        print("Lower!")
    else:
        print("You cracked it!")
        break

for i in range(1, 4):
    print("*" * i)

total = 0
for n in range(1, 101):
    total += n
print(total)

for n in range(5, 0, -1):
    print(n)
print("Launch!")

for n in range(2):  # repeat twice
    print("Reactor", n)  # show the number
