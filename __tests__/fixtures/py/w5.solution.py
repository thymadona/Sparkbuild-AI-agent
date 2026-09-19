import random


def cast():
    print("Abracadabra!")


cast()


def zap(target):
    print("Zap!", target)


zap("Ghost")


def damage(power):
    return power * 2


print(damage(5))

roll = random.randint(1, 6)
print("You rolled", roll)

monster_hp = 20
while monster_hp > 0:
    monster_hp = monster_hp - damage(3)
    print("Monster HP:", max(monster_hp, 0))
print("Monster defeated!")


def heal(hp, amount):
    return hp + amount


print(heal(5, 3))


def crit_strike():
    chance = random.randint(1, 10)
    if chance > 8:
        print("CRIT!")


crit_strike()


def shield(dmg):
    return dmg // 2


print(shield(10))

hp = 10  # start with 10 hp
hp = hp - 3  # take 3 damage
print("HP:", hp)  # show the hp
