import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

/** A controllable window.matchMedia: `set` flips the result and notifies the listeners. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  const matchMedia = vi.fn(() => media)
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    matchMedia,
    listeners,
    set(next: boolean) {
      media.matches = next
      listeners.forEach((listener) => listener())
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('useMediaQuery', () => {
  it('is false where matchMedia does not exist, so the phone layout is the default', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'))

    expect(result.current).toBe(false)
    expect(() => unmount()).not.toThrow()
  })

  it('reports whether the query matches', () => {
    const { matchMedia } = stubMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))

    expect(result.current).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 1024px)')
  })

  it('follows the query when the window is resized, and stops listening on unmount', () => {
    const media = stubMatchMedia(false)
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(false)

    act(() => media.set(true))
    expect(result.current).toBe(true)

    act(() => media.set(false))
    expect(result.current).toBe(false)

    unmount()
    expect(media.listeners.size).toBe(0)
  })
})
