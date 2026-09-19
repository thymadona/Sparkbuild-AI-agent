# guess: torch
backpack = ["sword", "map", "torch"]
print(backpack[0])
print(len(backpack))
print(backpack[-1])

for item in backpack:
    print(item)

backpack.append("potion")
if "map" in backpack:
    backpack.remove("map")

stats = {"sword": 5, "shield": 3}
for name, power in stats.items():
    print(name, power)

loot = {"sword": 5, "shield": 3, "bow": 4}
total = 0
best = ""
for name, power in loot.items():
    total += power
    if power > loot.get(best, 0):
        best = name
print("Total power:", total)
print("Best item:", best)
print("Items:", len(loot))

print(sorted(backpack))

traded = backpack.pop()
print(traded)

shopping = ["milk", "eggs", "rice", "tea", "jam"]
for thing in shopping:
    print(thing)

prices = {"apple": 2, "kiwi": 3}
print(prices["apple"])  # cost of an apple
print(prices["kiwi"])  # cost of a kiwi
print(len(prices))  # count the prices
