import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'

/** How long the pressed state stays visible before leaving (HU 22). */
export const LEAVE_FEEDBACK_MS = 500

interface LeaveRoomButtonProps {
  /** Leaves the room and navigates home; never waits for the server. */
  onLeave: () => void
}

/**
 * "Leave room" in the lobby, the battle and the results. Once pressed it turns
 * red, reads "Leaving…" and is disabled for a short moment so the player sees
 * the press, then leaves. A second press cannot leave twice, and if the button
 * unmounts before the delay ends (the screen changed), the leave runs at once.
 */
export function LeaveRoomButton({ onLeave }: LeaveRoomButtonProps) {
  const [leaving, setLeaving] = useState(false)
  const pendingRef = useRef<{ timer: number; leave: () => void } | null>(null)

  useEffect(
    () => () => {
      const pending = pendingRef.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      pendingRef.current = null
      pending.leave()
    },
    [],
  )

  const handleClick = () => {
    if (leaving) return
    setLeaving(true)
    const leave = () => {
      pendingRef.current = null
      onLeave()
    }
    pendingRef.current = { timer: window.setTimeout(leave, LEAVE_FEEDBACK_MS), leave }
  }

  return (
    <Button variant={leaving ? 'danger' : 'ghost'} disabled={leaving} data-leaving={leaving} onClick={handleClick}>
      {leaving ? 'Leaving…' : 'Leave room'}
    </Button>
  )
}
