import { useState } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'

interface LeaveRoomButtonProps {
  /** Leaves the room and navigates home; never waits for the server. */
  onLeave: () => void
}

/**
 * "Leave room" in the lobby, the battle and the results. Once pressed it turns
 * red, reads "Leaving…" and is disabled, so a second press cannot leave twice.
 */
export function LeaveRoomButton({ onLeave }: LeaveRoomButtonProps) {
  const [leaving, setLeaving] = useState(false)

  const handleClick = () => {
    if (leaving) return
    setLeaving(true)
    onLeave()
  }

  return (
    <Button variant={leaving ? 'danger' : 'ghost'} disabled={leaving} data-leaving={leaving} onClick={handleClick}>
      {leaving ? 'Leaving…' : 'Leave room'}
    </Button>
  )
}
