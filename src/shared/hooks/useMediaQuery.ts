import { useCallback, useSyncExternalStore } from 'react'

/**
 * True while the CSS media query matches, updated when the window is resized or
 * the device rotated. For the rare case where the two layouts need a different
 * element order that CSS alone cannot give; prefer Tailwind breakpoints otherwise.
 * False where matchMedia does not exist, so the phone layout is the default.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
}
