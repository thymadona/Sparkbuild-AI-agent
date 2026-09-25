# TASK: show-plan
# goal: Rex runs a quiz and tells your score
# step: say hi to the player by name
# step: ask one question and say if right
# step: keep a score
# step: ask 3 questions and show the score
# done: I answer 3 questions and see Score: 3
# ask: say hi to the player by name
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex says hi

# TASK: show-question
# goal: Rex runs a quiz and tells your score
# step: say hi to the player by name
# step: ask one question and say if right
# step: keep a score
# step: ask 3 questions and show the score
# done: I answer 3 questions and see Score: 3
# ask: say hi to the player by name
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex says hi
# ask: ask 2 + 2 and say Right! for 4
answer = input("2 + 2? ")  # Rex asks a sum
if answer == "4":  # 4 is the right answer
    print("Right!")  # Rex cheers

# TASK: show-score
# goal: Rex runs a quiz and tells your score
# step: say hi to the player by name
# step: ask one question and say if right
# step: keep a score
# step: ask 3 questions and show the score
# done: I answer 3 questions and see Score: 3
# ask: say hi to the player by name
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex says hi
# ask: ask 2 + 2 and say Right! for 4
# ask: keep a score, add 1 for a right answer, show Score
score = 0  # start at zero
answer = input("2 + 2? ")  # Rex asks a sum
if answer == "4":  # 4 is the right answer
    print("Right!")  # Rex cheers
    score = score + 1  # one more point
print("Score:", score)  # show the points

# TASK: show-final
# goal: Rex runs a quiz and tells your score
# step: say hi to the player by name
# step: ask one question and say if right
# step: keep a score
# step: ask 3 questions and show the score
# done: I answer 3 questions and see Score: 3
# ask: say hi to the player by name
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex says hi
# ask: ask 2 + 2 and say Right! for 4
# ask: keep a score, add 1 for a right answer, show Score
# ask: ask 2 + 2, 3 x 3 and 10 - 4, add 1 for each right, show Score
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
print("Score:", score)  # show the points

# TASK: show-extra
# goal: Rex runs a space show and names a planet
# step: say welcome to the space show
# step: ask a planet and say it back
# done: I type Mars and see Mars is cool
# ask: say welcome to the space show
print("Welcome to the Space Show!")  # the show starts
# ask: ask a planet and say it back
planet = input("A planet? ")  # Rex asks
print(planet + " is cool!")  # Rex says it back

# TASK: hw-prize
# goal: Rex runs a quiz and tells your score
# step: say hi to the player by name
# step: ask one question and say if right
# step: keep a score
# step: ask 3 questions and show the score
# step: gold star for 3 right
# done: I answer 3 questions and see Score: 3
# ask: say hi to the player by name
name = input("Your name? ")  # Rex asks who plays
print("Hi " + name + "! Welcome to Rex's show")  # Rex says hi
# ask: ask 2 + 2 and say Right! for 4
# ask: keep a score, add 1 for a right answer, show Score
# ask: ask 2 + 2, 3 x 3 and 10 - 4, add 1 for each right, show Score
quiz = {"2 + 2? ": "4", "3 x 3? ": "9", "10 - 4? ": "6"}  # questions and answers
score = 0  # start at zero
for q in quiz:  # each question
    if input(q) == quiz[q]:  # a right answer?
        print("Right!")  # Rex cheers
        score = score + 1  # one more point
print("Score:", score)  # show the points
if score == 3:  # all right
    print("Gold star!")  # the prize

# TASK: hw-riddle
# goal: Rex asks a riddle and says if I got it
# step: Rex asks the riddle
# step: say Right for piano
# done: I type piano and see Right!
# ask: ask What has keys but no doors?
answer = input("What has keys but no doors? ")  # the riddle
# ask: say Right! if the answer is piano
if answer == "piano":  # the right answer
    print("Right!")  # Rex cheers
