import { useEffect, useState } from 'react'

const TICK_MS = 100

/** Milliseconds left until `expiresAt` (ISO string), refreshed every 100 ms. */
export function useCountdown(expiresAt: string | null): number {
  const deadline = expiresAt ? Date.parse(expiresAt) : null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [deadline])

  return deadline === null ? 0 : Math.max(0, deadline - now)
}
