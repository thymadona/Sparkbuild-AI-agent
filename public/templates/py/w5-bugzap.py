# BUG ZAP: this spell should print 10, but it prints None.
# Press Run. Why does the spell give nothing back?

# TASK: hw-bug-return
def double_damage(power):
    result = power * 2

print(double_damage(5))
