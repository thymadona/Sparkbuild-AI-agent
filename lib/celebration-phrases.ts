// Rotating copy for celebration UI (progress banners, completion moments).
// Deliberately separate from the tutor's own freeform chat text — this is
// UI-rendered copy the client fully controls, so "never repeats twice in a
// row" can be guaranteed in code instead of just asked of the model.

export const TASK_DONE_PHRASES = [
  'Nice one! ✨',
  "That's the one!",
  'Boom, done!',
  'You got it!',
  'Nailed it!',
]

export const CORE_COMPLETE_PHRASES = [
  '🎉 Core mission complete!',
  '🎉 You did it — the core mission is done!',
  '🎉 Mission complete! Your project works.',
]

export const ALL_COMPLETE_PHRASES = [
  '✨ Every challenge complete. Nice work!',
  '✨ All 5 sparks collected. You crushed it!',
  '✨ Everything done — that took real focus!',
]

/**
 * Picks a random phrase, avoiding an immediate repeat of `lastPhrase`. Falls
 * back to whatever it picks if the bank has only one phrase.
 */
export function pickPhrase(bank: string[], lastPhrase: string | null): string {
  if (bank.length <= 1) return bank[0] ?? ''
  const choices = bank.filter((phrase) => phrase !== lastPhrase)
  return choices[Math.floor(Math.random() * choices.length)]
}
