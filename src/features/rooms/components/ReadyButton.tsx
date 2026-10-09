import { Button } from '../../../shared/ui/atoms/Button'

interface ReadyButtonProps {
  ready: boolean
  /** The change is waiting for the server; the button stays disabled meanwhile. */
  pending: boolean
  onToggle: () => void
}

/** Lets a player tell the room they are ready to dance, and take it back before the battle starts. */
export function ReadyButton({ ready, pending, onToggle }: ReadyButtonProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-sm text-slate-300">
        {ready ? "You are ready. Everyone in the room can see it." : 'Press the button when you are ready to dance.'}
      </p>
      <div>
        <Button
          variant={ready ? 'success' : 'secondary'}
          aria-pressed={ready}
          disabled={pending}
          onClick={onToggle}
        >
          {ready ? 'Ready - click to cancel' : "I'm ready"}
        </Button>
      </div>
    </div>
  )
}
