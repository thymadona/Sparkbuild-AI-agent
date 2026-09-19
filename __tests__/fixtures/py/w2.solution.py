import sparky

# guess: 62
coins = 50
price = 12
print(coins + price)
print(price * 3)
print(coins // price)
print(coins % price)
# guess: True
print(coins > price)
print(price == coins)

secret = 1234
guess = 1234
if guess == secret:
    sparky.open_door()
    print("Door open!")
elif guess > 1000 and guess < 9999:
    print("Warm... almost!")
elif guess < 1000:
    sparky.close_door()
    print("Cold...")
else:
    sparky.alarm()
    print("ALARM! Wrong code!")

if coins % 2 == 0:
    print("even")
else:
    print("odd")

total = 80
if total > 50:
    total = total - 10
print(total)
