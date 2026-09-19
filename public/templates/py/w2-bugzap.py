# BUG ZAP: Sparky's door never opens, even with the right code.
# Press Run and read the last line of the red text.

# TASK: hw-bug-equals
secret = 42
guess = 42
if guess = secret:
    print("Door open!")
else:
    print("Door locked!")
