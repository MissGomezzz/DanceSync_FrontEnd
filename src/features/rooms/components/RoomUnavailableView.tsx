import { Button } from '../../../shared/ui/atoms/Button'

interface RoomUnavailableViewProps {
  roomCode: string
  reason: string
  onBack: () => void
  /** Retries the join, for example after a timeout. */
  onRetry?: () => void
}

/**
 * Shown when joining a room fails (unknown code, full room, battle already
 * running). Rendering the regular lobby here would look like an empty new room.
 */
export function RoomUnavailableView({ roomCode, reason, onBack, onRetry }: RoomUnavailableViewProps) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-10 text-center">
      <h1 className="text-2xl font-bold text-ink">Cannot join room {roomCode}</h1>
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{reason}</p>
      <p className="text-sm text-ink-muted">
        Check the code with the room host. Rooms close automatically when every player leaves.
      </p>
      <div className="flex gap-3">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button onClick={onBack}>Back to home</Button>
      </div>
    </section>
  )
}
