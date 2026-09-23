'use client'

import { useSyncExternalStore } from 'react'

// Mirrors Tailwind's `md:` breakpoint (768px, min-width) so JS and CSS agree
// on where "narrow" ends. 767.98px (not 768px) avoids the boundary case at
// exactly 768 — iPad portrait — disagreeing with Tailwind's min-width:768px.
const QUERY = '(max-width: 767.98px)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useIsNarrow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
