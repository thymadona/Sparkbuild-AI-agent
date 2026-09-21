// Browser text-to-speech: free, no key, no server. Shared by the read-aloud button
// and Sparky's voice, so only one thing ever speaks at a time.
export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
}

// Slower than default: these are instructions, not prose.
export function speak(text: string, onEnd?: () => void) {
  if (!speechSupported() || !text.trim()) return onEnd?.()
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  synth.speak(utterance)
}
