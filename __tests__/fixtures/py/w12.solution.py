# TASK: demo-run
# done: I answer 4, 9 and 6 and see Score: 3
name = input("Your name? ")
print("Hi " + name + "! Welcome to Rex's show")
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}
score = 0
for q in quiz:
    if input(q) == quiz[q]:
        print("Right!")
        score = score + 1
print("Score:", score)

# TASK: demo-explain
# done: I answer 4, 9 and 6 and see Score: 3
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex greets the player
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
print("Score:", score)  # show the points

# TASK: demo-change
# done: I answer 4, 9, 6 and 10 and see Score: 4
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex greets the player
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6", "5 + 5? ": "10"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
print("Score:", score)  # show the points

# TASK: demo-day
# done: I get all 4 right and see Perfect show, Mia!
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex greets the player
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6", "5 + 5? ": "10"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
print("Score:", score)  # show the points
if score == 4:  # all right?
    print("Perfect show, " + name + "!")  # Rex cheers you

# TASK: demo-own
# done: I type Mia and see Hi Mia, you are a star
name = input("Name? ")  # ask the name
print("Hi " + name + ", you are a star")  # say it back

# TASK: hw-answer
# done: I get all 4 right and see Perfect show, Mia!
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex greets the player
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6", "5 + 5? ": "10"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
    else:  # a wrong answer
        print("It was", quiz[q])  # Rex tells it
print("Score:", score)  # show the points
if score == 4:  # all right?
    print("Perfect show, " + name + "!")  # Rex cheers you

# TASK: hw-cheer-up
# done: I get all 4 right and see Perfect show, Mia!
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex greets the player
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6", "5 + 5? ": "10"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
print("Score:", score)  # show the points
if score == 4:  # all right?
    print("Perfect show, " + name + "!")  # Rex cheers you
if score < 2:  # a low score
    print("Try again!")  # Rex cheers you up
