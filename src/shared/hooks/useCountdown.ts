import { useEffect, useState } from 'react'

const TICK_MS = 100

/** Monotonic local clock; never compared with the server's wall clock. */
const readClock = () => performance.now()

/**
 * Milliseconds left until `deadline` (a performance.now() timestamp), refreshed
 * every 100 ms. Deadlines come from the server's relative "time left" values
 * (see useServerDeadline), so the countdown never compares the browser's wall
 * clock with the server's.
 */
export function useCountdown(deadline: number | null): number {
  const [tick, setTick] = useState(() => ({ deadline, now: readClock() }))

  let now = tick.now
  if (tick.deadline !== deadline) {
    // A new deadline reads the clock during render (React's "adjusting state when
    // a prop changes"), so its first frame never shows a value from a stale tick.
    now = readClock()
    setTick({ deadline, now })
  }

  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => setTick({ deadline, now: readClock() }), TICK_MS)
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
  const instant = useServerInstant(remainingMs, payload, fallbackExpiresAt)
  // A deadline that already passed is "now": the countdown shows zero, never a negative value.
  return instant === null ? null : Math.max(instant.at, instant.receivedAt)
}

/**
 * Like useServerDeadline, but for a moment that may already be in the past:
 * `offsetMs` is "that moment minus the server's now" when the payload was
 * emitted, so a negative value means it happened |offsetMs| ago (for example the
 * start of a battle that is already running). Returns the performance.now()
 * timestamp of that moment, or null when neither value is known.
 *
 * `fallbackAt` (an absolute ISO date) is only used when `offsetMs` is absent.
 */
export function useServerTime(
  offsetMs: number | null | undefined,
  payload: unknown,
  fallbackAt: string | null = null,
): number | null {
  return useServerInstant(offsetMs, payload, fallbackAt)?.at ?? null
}

interface ServerInstant {
  /** performance.now() timestamp of the server moment. */
  at: number
  /** performance.now() when the payload that carried it was received. */
  receivedAt: number
}

function useServerInstant(
  offsetMs: number | null | undefined,
  payload: unknown,
  fallbackAt: string | null,
): ServerInstant | null {
  const [state, setState] = useState(() => ({ payload, instant: toInstant(offsetMs, payload, fallbackAt) }))

  if (state.payload !== payload) {
    // Derived during render (React's "adjusting state when a prop changes"), so the
    // first frame after a payload already uses the fresh value.
    const next = { payload, instant: toInstant(offsetMs, payload, fallbackAt) }
    setState(next)
    return next.instant
  }
  return state.instant
}

/**
 * When each payload object was first seen by any of these hooks. A relative
 * value ("ends in 40 s") only means something at the moment its payload
 * arrived, so a component that mounts later (a panel that moves when the
 * layout changes) must anchor on that moment, not on its own mount.
 */
const payloadReceivedAt = new WeakMap<object, number>()

function receivedAtOf(payload: unknown): number {
  const now = readClock()
  if (typeof payload !== 'object' || payload === null) return now
  const known = payloadReceivedAt.get(payload)
  if (known !== undefined) return known
  payloadReceivedAt.set(payload, now)
  return now
}

function toInstant(
  offsetMs: number | null | undefined,
  payload: unknown,
  fallbackAt: string | null,
): ServerInstant | null {
  const receivedAt = receivedAtOf(payload)
  if (typeof offsetMs === 'number' && Number.isFinite(offsetMs)) return { at: receivedAt + offsetMs, receivedAt }
  if (fallbackAt) {
    const at = Date.parse(fallbackAt)
    // An absolute date is converted against the wall clock as it reads right now.
    if (!Number.isNaN(at)) return { at: readClock() + (at - Date.now()), receivedAt }
  }
  return null
}
