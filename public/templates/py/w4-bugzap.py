# BUG ZAP: this loop crashes with an IndexError.
# Press Run and read the last line of the red text.

# TASK: hw-bug-index
fruits = ["apple", "pear", "plum"]
for i in range(4):
    print(fruits[i])
print("Basket done!")
