import { Button } from '../../../shared/ui/atoms/Button'
import type { Player } from '../../../shared/types'

interface RoleSelectorProps {
  myRole: Player['role'] | undefined
  onSelectDancer: () => void
  onSelectSpectator: () => void
}

export function RoleSelector({ myRole, onSelectDancer, onSelectSpectator }: RoleSelectorProps) {
  if (myRole && myRole !== 'undecided') {
    return (
      <p className="text-sm text-slate-400">
        You chose: <span className="font-semibold text-brand-red">{myRole === 'dancer' ? 'Dancer' : 'Spectator'}</span>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-sm text-slate-300">Choose your role for this room:</p>
      <div className="flex gap-3">
        <Button onClick={onSelectDancer}>Dance (camera required)</Button>
        <Button variant="secondary" onClick={onSelectSpectator}>Spectate</Button>
      </div>
    </div>
  )
}