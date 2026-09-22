// Browser text-to-speech: free, no key, no server. Shared by the read-aloud button
// and Sparky's voice, so only one thing ever speaks at a time.
export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
}

// Strips markdown that would otherwise be read aloud literally (e.g. "backtick
// age backtick"). Bold requires the doubled `**` form so a lone multiplication
// `*`, e.g. "2 * 3 * 4", is never touched.
export const stripMarkdown = (text: string) =>
  text.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')

// Slower than default: these are instructions, not prose.
export function speak(text: string, onEnd?: () => void) {
  if (!speechSupported() || !text.trim()) return onEnd?.()
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  synth.speak(utterance)
}
