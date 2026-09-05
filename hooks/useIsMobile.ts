'use client'

import { useEffect, useState } from 'react'

// Phones (any pointer) OR touch tablets up to 1366px — the CSS width of an
// iPad Pro 12.9" in landscape, the largest current iPad in either
// orientation. `pointer: coarse` reflects the *primary* pointer, so a
// desktop/laptop with a mouse stays on the desktop layout even when resized
// narrow or fitted with a touchscreen — only touch-primary devices match.
const MOBILE_QUERY = '(max-width: 767px), (max-width: 1366px) and (pointer: coarse)'

// Resolves on mount (SSR/first paint has no viewport to check) — callers that
// branch their whole render tree on this must gate on `resolved` too, or the
// desktop branch mounts first and gets replaced once this settles, remounting
// anything with its own internal state (e.g. a chat draft in <Editor>).
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    setIsMobile(mql.matches)
    setResolved(true)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return { isMobile, resolved }
}
