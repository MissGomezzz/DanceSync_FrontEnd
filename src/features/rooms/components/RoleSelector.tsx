import { Button } from '../../../shared/ui/atoms/Button'
import type { Player } from '../../../shared/types'

interface RoleSelectorProps {
  myRole: Player['role'] | undefined
  /** A role change is waiting for the server; both buttons stay disabled meanwhile. */
  pending: boolean
  onSelectDancer: () => void
  onSelectSpectator: () => void
}

const roleLabels: Record<'dancer' | 'spectator', string> = {
  dancer: 'You will dance.',
  spectator: 'You will spectate.',
}

/**
 * Both choices stay visible so a player can switch while the room is waiting;
 * the current one is marked with aria-pressed.
 */
export function RoleSelector({ myRole, pending, onSelectDancer, onSelectSpectator }: RoleSelectorProps) {
  const chosen = myRole === 'dancer' || myRole === 'spectator' ? myRole : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-sm text-slate-300">
        {chosen
          ? `${roleLabels[chosen]} You can switch until the battle starts.`
          : 'Choose your role for this room:'}
      </p>
      <div className="flex gap-3" role="group" aria-label="Your role">
        <Button
          variant={chosen === 'dancer' ? 'primary' : 'secondary'}
          aria-pressed={chosen === 'dancer'}
          disabled={pending}
          onClick={onSelectDancer}
        >
          Dance (camera required)
        </Button>
        <Button
          variant={chosen === 'spectator' ? 'primary' : 'secondary'}
          aria-pressed={chosen === 'spectator'}
          disabled={pending}
          onClick={onSelectSpectator}
        >
          Spectate
        </Button>
      </div>
    </div>
  )
}
