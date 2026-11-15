import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface Polled<T> {
  data: T | null
  error: string | null
  /** When the data was last refreshed (epoch ms). */
  updatedAt: number | null
  refresh: () => Promise<void>
}

/**
 * Loads `load` now and every `intervalMs` while the tab is visible (null: only on demand), and again
 * whenever `key` changes (the filters it depends on). A slow answer never overwrites a newer one:
 * each request aborts the one before it.
 */
export function usePolling<T>(load: (signal: AbortSignal) => Promise<T>, intervalMs: number | null, key = ''): Polled<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const controller = useRef<AbortController | null>(null)
  const loadRef = useRef(load)
  useLayoutEffect(() => {
    loadRef.current = load
  })

  const refresh = useCallback(async () => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    try {
      const result = await loadRef.current(current.signal)
      if (current.signal.aborted) return
      setData(result)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (cause) {
      if (current.signal.aborted) return
      setError(cause instanceof Error ? cause.message : 'Request failed')
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (intervalMs === null) return () => controller.current?.abort()
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, intervalMs)
    return () => {
      clearInterval(timer)
      controller.current?.abort()
    }
  }, [refresh, intervalMs, key])

  return { data, error, updatedAt, refresh }
}
