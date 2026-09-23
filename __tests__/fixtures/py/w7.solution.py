dex = {"slime": 2, "bat": 5, "golem": 9}
print(dex["bat"])
dex["imp"] = 3
dex["bat"] = dex["bat"] + 1
print(dex)

if "yeti" in dex:
    print(dex["yeti"])
else:
    print("No yeti yet")
print(dex.get("yeti", 0))

sightings = ["bat", "imp", "bat", "slime", "bat"]
seen = {}
for name in sightings:
    seen[name] = seen.get(name, 0) + 1
print(seen)

types = {"fire": ["imp"], "ice": ["yeti"]}
types["fire"].append("drake")
for kind, names in types.items():
    print(kind, names)

log = ["ghost", "bat", "ghost", "imp", "ghost", "bat", "ghost", "slime"]
tally = {}
for name in log:
    tally[name] = tally.get(name, 0) + 1
top = ""
for name, n in tally.items():
    if n > tally.get(top, 0):
        top = name
print("Most seen:", top)
print("Total:", len(log))

del dex["slime"]
print(dex)

my_dex = {"wisp": 1, "troll": 7, "pixie": 2, "kraken": 10, "gnome": 3}
print(my_dex["troll"])

eggs = {"dragon": 1, "phoenix": 2}
print(eggs["dragon"])  # the dragon egg count
print(eggs.get("griffin", 0))  # 0, no griffin egg
print(len(eggs))  # how many kinds of egg
