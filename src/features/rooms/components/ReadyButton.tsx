import { Button } from '../../../shared/ui/atoms/Button'

interface ReadyButtonProps {
  ready: boolean
  /** The change is waiting for the server; the button stays disabled meanwhile. */
  pending: boolean
  onToggle: () => void
}

/**
 * Lets any player, dancer or spectator, tell the room they are ready to start,
 * and take it back before the battle starts. The label never changes: the
 * toggle state is aria-pressed (and the button's color and check mark).
 */
export function ReadyButton({ ready, pending, onToggle }: ReadyButtonProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-sm text-slate-300">
        {ready
          ? 'You are ready. Everyone in the room can see it; press the button again to cancel.'
          : 'Mark yourself ready when you are ready to start.'}
      </p>
      <div>
        <Button variant={ready ? 'success' : 'secondary'} aria-pressed={ready} disabled={pending} onClick={onToggle}>
          <span aria-hidden="true" className={`mr-2 ${ready ? '' : 'opacity-0'}`}>
            ✓
          </span>
          I'm ready
        </Button>
      </div>
    </div>
  )
}
