import type { Player } from '../../../shared/types'

interface RatingPanelViewProps {
  dancers: Player[]
  maxStars: number
  /** Only spectators may rate; dancers see a read-only note. */
  canRate: boolean
  scoreFor: (dancerId: string) => number
  isRated: (dancerId: string) => boolean
  pendingDancerId: string | null
  error: string | null
  onRate: (dancerId: string, score: number) => void
}

export function RatingPanelView({
  dancers,
  maxStars,
  canRate,
  scoreFor,
  isRated,
  pendingDancerId,
  error,
  onRate,
}: RatingPanelViewProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Rate the dancers</h2>

      {!canRate && <p className="text-sm text-slate-500">Only spectators can rate the dancers.</p>}

      {canRate &&
        dancers.map((dancer) => {
          const rated = isRated(dancer.id)
          const disabled = rated || pendingDancerId !== null
          return (
            <div key={dancer.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{dancer.displayName}</span>
              <div className="flex items-center gap-1" role="radiogroup" aria-label={`Rating for ${dancer.displayName}`}>
                {Array.from({ length: maxStars }, (_, index) => index + 1).map((value) => {
                  const active = value <= scoreFor(dancer.id)
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={value === scoreFor(dancer.id)}
                      aria-label={`${value} stars`}
                      disabled={disabled}
                      onClick={() => onRate(dancer.id, value)}
                      className={`text-lg transition-colors ${active ? 'text-amber-400' : 'text-slate-600'} disabled:cursor-not-allowed`}
                    >
                      {'★'}
                    </button>
                  )
                })}
                {rated && <span className="ml-2 text-xs text-emerald-300">Rated</span>}
              </div>
            </div>
          )
        })}

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {canRate && (
        <p className="text-xs text-slate-500">The battle finishes once every spectator has rated both dancers.</p>
      )}
    </section>
  )
}
