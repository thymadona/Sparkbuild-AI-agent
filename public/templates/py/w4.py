# WEEK 4: The Inventory Raid
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
# HOMEWORK: make a shopping list of 5 things. Loop over it.


# TASK: hw-comment
# HOMEWORK: add a # note after each print line.
prices = {"apple": 2, "kiwi": 3}
print(prices["apple"])
print(prices["kiwi"])
print(len(prices))
