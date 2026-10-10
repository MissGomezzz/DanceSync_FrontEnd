import type { KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/atoms/Button'

interface EndAnnouncementViewProps {
  /** "Ana wins!", "It's a draw", or null when the battle ended without a result. */
  outcome: string | null
  /** "The song ended", "Not enough dancers left"; null when unknown. */
  endReason: string | null
  onDismiss: () => void
}

/** Full-screen "Battle over!" overlay shown to every player when the battle finishes. */
export function EndAnnouncementView({ outcome, endReason, onDismiss }: EndAnnouncementViewProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onDismiss()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-over-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-(--layer-overlay) flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur-sm"
    >
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-amber-400/50 bg-slate-900 px-8 py-10 text-center shadow-2xl">
        <h2 id="battle-over-title" className="text-4xl font-extrabold tracking-tight text-amber-300">
          Battle over!
        </h2>
        {outcome && <p className="text-2xl font-bold text-slate-100">{outcome}</p>}
        {endReason && <p className="text-sm text-slate-400">{endReason}</p>}
        {/* The dialog is modal: focus goes to its only control. */}
        <Button autoFocus className="mt-3" onClick={onDismiss}>
          See the results
        </Button>
      </div>
    </div>
  )
}
