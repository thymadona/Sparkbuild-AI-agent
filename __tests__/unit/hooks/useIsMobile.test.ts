/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { useIsMobile } from '@/hooks/useIsMobile'

function mockMatchMedia(initialMatches: boolean) {
  let listener: ((e: MediaQueryListEvent) => void) | null = null
  const mql = {
    matches: initialMatches,
    media: '',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => { listener = cb },
    removeEventListener: () => { listener = null },
  }
  window.matchMedia = jest.fn().mockReturnValue(mql)
  return {
    fireChange: (matches: boolean) => act(() => listener?.({ matches } as MediaQueryListEvent)),
  }
}

describe('useIsMobile', () => {
  it('resolves false when the media query does not match', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current.resolved).toBe(true)
    expect(result.current.isMobile).toBe(false)
  })

  it('resolves true when the media query matches', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current.isMobile).toBe(true)
  })

  it('responds to a later change event', () => {
    const { fireChange } = mockMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current.isMobile).toBe(false)
    fireChange(true)
    expect(result.current.isMobile).toBe(true)
  })
})
