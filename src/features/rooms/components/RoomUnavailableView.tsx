import { Button } from '../../../shared/ui/atoms/Button'

interface RoomUnavailableViewProps {
  roomCode: string
  reason: string
  onBack: () => void
}

/**
 * Shown when joining a room fails (unknown code, full room, battle already
 * running). Rendering the regular lobby here would look like an empty new room.
 */
export function RoomUnavailableView({ roomCode, reason, onBack }: RoomUnavailableViewProps) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-10 text-center">
      <h1 className="text-2xl font-bold">Cannot join room {roomCode}</h1>
      <p className="rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{reason}</p>
      <p className="text-sm text-slate-400">
        Check the code with the room host. Rooms close automatically when every player leaves.
      </p>
      <Button onClick={onBack}>Back to home</Button>
    </section>
  )
}
