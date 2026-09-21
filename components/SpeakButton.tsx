'use client'

import { useEffect, useState } from 'react'
import { speak as say, speechSupported, stopSpeaking } from '@/lib/speech'

interface SpeakButtonProps {
  text: string
  label?: string
  className?: string
}

/**
 * Reads text aloud using the browser's built-in speech synthesis.
 *
 * For a student who understands spoken instructions but decodes text slowly,
 * this is the difference between a usable task and a wall. No backend, no key,
 * no cost. Renders nothing when the browser cannot speak.
 */
export default function SpeakButton({ text, label = 'Read this out loud', className = '' }: SpeakButtonProps) {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => setSupported(speechSupported()), [])

  useEffect(() => {
    return () => stopSpeaking()
  }, [])

  if (!supported || !text.trim()) return null

  function speak() {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    say(text, () => setSpeaking(false))
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={speaking ? 'Stop reading' : label}
      title={speaking ? 'Stop reading' : label}
      className={`shrink-0 rounded p-1 text-fg-muted transition-colors hover:bg-surface-700 hover:text-fg-secondary ${className}`}
    >
      {speaking ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7" />
        </svg>
      )}
    </button>
  )
}
