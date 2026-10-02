import { useEffect, useState } from 'react'

const TICK_MS = 100

/**
 * Milliseconds left until `deadline` (a performance.now() timestamp), refreshed
 * every 100 ms. Deadlines come from the server's relative "time left" values
 * (see useServerDeadline), so the countdown never compares the browser's wall
 * clock with the server's.
 */
export function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (deadline === null) return
    setNow(performance.now())
    const id = setInterval(() => setNow(performance.now()), TICK_MS)
    return () => clearInterval(id)
  }, [deadline])

  return deadline === null ? 0 : Math.max(0, deadline - now)
}

/**
 * Turns a server-computed "milliseconds left" into a local performance.now()
 * deadline, recomputed whenever a new `payload` (the object that carried the
 * value) arrives and kept stable across re-renders in between.
 *
 * `fallbackExpiresAt` (an absolute ISO date) is only used when the server did
 * not send `remainingMs`; it trusts the local wall clock, so it is skew-prone.
 */
export function useServerDeadline(
  remainingMs: number | null | undefined,
  payload: unknown,
  fallbackExpiresAt: string | null = null,
): number | null {
  const [state, setState] = useState(() => ({
    payload,
    deadline: toDeadline(remainingMs, fallbackExpiresAt),
  }))

  if (state.payload !== payload) {
    // Derived during render (React's "adjusting state when a prop changes"), so the
    // first frame after a payload already counts down from the fresh value.
    const next = { payload, deadline: toDeadline(remainingMs, fallbackExpiresAt) }
    setState(next)
    return next.deadline
  }
  return state.deadline
}

function toDeadline(remainingMs: number | null | undefined, fallbackExpiresAt: string | null): number | null {
  if (typeof remainingMs === 'number') return performance.now() + Math.max(0, remainingMs)
  if (fallbackExpiresAt) {
    const expiresAt = Date.parse(fallbackExpiresAt)
    if (!Number.isNaN(expiresAt)) return performance.now() + Math.max(0, expiresAt - Date.now())
  }
  return null
}
