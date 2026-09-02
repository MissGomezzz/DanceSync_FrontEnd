import type { Player } from '../../../shared/types'
import { Button } from '../../../shared/ui/atoms/Button'

interface RatingPanelViewProps {
  dancers: Player[]
  maxStars: number
  starsFor: (dancerId: string) => number
  submitted: boolean
  onRate: (dancerId: string, stars: number) => void
  onSubmit: () => void
}

export function RatingPanelView({ dancers, maxStars, starsFor, submitted, onRate, onSubmit }: RatingPanelViewProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Rate the dancers</h2>

      {dancers.length === 0 && <p className="text-sm text-slate-500">No dancers to rate.</p>}

      {dancers.map((dancer) => (
        <div key={dancer.id} className="flex items-center justify-between gap-3">
          <span className="text-sm">{dancer.displayName}</span>
          <div className="flex gap-1" role="radiogroup" aria-label={`Rating for ${dancer.displayName}`}>
            {Array.from({ length: maxStars }, (_, index) => index + 1).map((value) => {
              const active = value <= starsFor(dancer.id)
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={value === starsFor(dancer.id)}
                  aria-label={`${value} stars`}
                  disabled={submitted}
                  onClick={() => onRate(dancer.id, value)}
                  className={`text-lg transition-colors ${active ? 'text-amber-400' : 'text-slate-600'} disabled:cursor-not-allowed`}
                >
                  {'★'}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <Button onClick={onSubmit} disabled={submitted || dancers.length === 0}>
        {submitted ? 'Ratings submitted' : 'Submit ratings'}
      </Button>
    </section>
  )
}
