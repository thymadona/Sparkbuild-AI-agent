# Tutor burst limit: requirements

Roadmap phase 2. It was first written as "remove the tutor rate limit". Once we talked it through,
the goal changed: drop the hourly cap, but keep a guard against abuse.

## Scope

- Replace the 50 turns per hour cap on Sparky with a **burst limit of 30 turns per minute** per
  student.
- A student who hits the limit sees a soft "slow down" caption, not "Sparky needs a rest".
- The server's 429 error says to slow down. It no longer says "Resets in N hours".

## Non-goals

- No removal of Redis or of the limiter itself.
- No daily or weekly cap.
- No admin view for abuse, such as a top-users list.
- No change to the staff bypass, the fail-open behaviour, or the length limits on messages and code.
- No change to the tutor prompt.

## Decisions and why

- **The cap goes, the guard stays.** Cost is no longer a reason to limit students. The risk left
  is abuse: a script, or someone using a student's session, calling the tutor in a tight loop. A
  short-window burst limit stops that without ever stopping a real child working through a long
  lesson.
- **30 turns per minute.** Runs, quiz answers and stage results each send a turn too, so a fast
  student can send several a minute. Thirty a minute is one every two seconds, kept up for a whole
  minute. No human reaches that, and a script trips it within seconds.
- **Known ceiling.** A script paced just under the limit is never blocked: up to about 1,800
  turns an hour per account. We accept that. The backstop is the prompt count on the staff
  overview plus deactivating the account. Add a daily cap later only if that happens in practice.
- **Reuse the existing sliding window.** The current limiter is already atomic, tested and keyed
  per student. We change its numbers, not its design.
- **A soft message.** A student who is clicking fast is not in trouble. The caption asks them to
  wait a moment. Quiet events, such as quiz feedback, stay silent on failure, as they do today.
- **Staff still bypass it.** Admins and teachers are trusted and test heavily.
- **It still fails open.** Redis is optional. An outage must not lock every student out of Sparky.

## Constraints

- No migration and no new environment variable.
- The Redis key name stays the same. Entries from the old hourly window are trimmed on each
  student's next turn, so no data step is needed.
- `scripts/reset-user.ts` keeps clearing the same key.
- The roadmap's phase 2 line is reworded to match this spec in the PR that ticks it.
