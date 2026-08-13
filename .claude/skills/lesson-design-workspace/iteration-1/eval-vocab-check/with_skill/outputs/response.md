Too advanced — it should be reworded before it ships.

I checked it against the live rules in `__tests__/unit/lib/lesson-copy.test.ts` rather than eyeballing it, since that file's `TOO_ADVANCED` list is the actual gate a hint has to clear:

- **Word count is fine** — "Adjust the gradient's duration to feel more energetic" is 8 words, under the 10-word hint budget (`MAX_WORDS.hint`).
- **Vocabulary fails.** Two words in it are on `TOO_ADVANCED` verbatim: `duration` and `energetic`. A `hint` field is checked against that list, so this would fail `bunx jest __tests__/unit/lib/lesson-copy.test.ts` outright.
- **`gradient` is also on that list**, and is the real subject of the sentence. It happens to slip past the *test's* regex here only because of a technicality: the check strips punctuation before comparing, so the possessive `gradient's` collapses to `gradients`, which isn't a literal match for the list entry `gradient`. That's an accident of tokenization, not a sign the word is fine — write it as `gradient duration` (no apostrophe) instead of `gradient's duration` and it fails immediately. I wouldn't rely on the possessive to sneak it through.

This isn't a guess about the reading level — the existing catalog already treats exactly these three concepts as too hard and works around them in checked copy:
- `lib/lessons.ts:419` has a gradient-background task, and its hint avoids the word entirely: *"Change the background of #game-area to your colors."*
- `lib/lessons.ts:394` has a game-duration task, and its hint uses the code identifier instead of the English word: *"Change gameDuration from 10 to your number."* (camelCase tokens are exempt from the vocabulary check — they're names on screen, not prose.)
- `energetic` only appears once in the whole catalog, in a `prompt` field (`lib/lessons.ts:403`, "three energetic score messages") — prompts aren't vocabulary-checked, hints are. So even the codebase's own precedent for that word stays out of checked fields.

Suggested rewrite, keeping the same intent (speed up the gradient animation) without the banned words: **"Make the background colors change faster."** (6 words, no flagged vocabulary.) If there's a specific CSS property or variable name backing this task (e.g. an `animation-duration` value or a named variable), naming that token directly is even better — code identifiers are exempt from the reading-level check and it's more concrete for a 10-year-old to edit a thing they can see on screen than to interpret "duration."
