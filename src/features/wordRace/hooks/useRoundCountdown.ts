import { useEffect, useState } from 'react'

const TICK_MS = 100

/**
 * Milliseconds left until `deadline` (a performance.now() timestamp), refreshed
 * every 100 ms. The song challenge's useCountdown counts down to an absolute ISO
 * date; the word race only receives the relative time left from the server, so
 * this hook never reads the wall clock.
 */
export function useRoundCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => setNow(performance.now()), TICK_MS)
    return () => clearInterval(id)
  }, [deadline])

  return deadline === null ? 0 : Math.max(0, deadline - now)
}
