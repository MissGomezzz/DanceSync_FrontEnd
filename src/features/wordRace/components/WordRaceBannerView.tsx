import type { WordRaceBanner, WordRaceBannerKind } from '../types'
import { TimeBar, TimeLeft, type WordRoundView } from './RoundTimer'

interface WordRaceBannerViewProps {
  /** Round being raced, or null while only the round result is shown. */
  round: WordRoundView | null
  result: WordRaceBanner | null
}

const resultTones: Record<WordRaceBannerKind, string> = {
  won: 'border-emerald-500/70 bg-emerald-950/90 text-emerald-200',
  lost: 'border-rose-500/70 bg-rose-950/90 text-rose-200',
  late: 'border-rose-500/70 bg-rose-950/90 text-rose-200',
  watching: 'border-fuchsia-700/60 bg-slate-900/95 text-slate-100',
  expired: 'border-slate-600 bg-slate-900/95 text-slate-300',
}

/**
 * Compact, non-modal word race banner for spectators, pinned to the top of the
 * stage: they follow the race without losing the dance or the vote buttons.
 */
export function WordRaceBannerView({ round, result }: WordRaceBannerViewProps) {
  if (!round && !result) return null
  const showResult = !round && result !== null

  return (
    <div className="sticky top-3 z-(--layer-banner)">
      {round && (
        <section
          key={round.roundId}
          aria-label="Word race"
          className="overflow-hidden rounded-xl border border-fuchsia-700/60 bg-slate-900/95 shadow-lg shadow-black/40 backdrop-blur motion-safe:animate-banner-in motion-reduce:animate-fade-in"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
              Word {round.roundNumber} of {round.totalRounds}
            </span>
            <p className="min-w-0 flex-1 text-sm text-slate-300">
              Dancers are racing to type:{' '}
              <strong data-testid="word-race-word" className="font-mono text-xl font-bold tracking-wide text-white">
                {round.word}
              </strong>
            </p>
            <TimeLeft remainingMs={round.remainingMs} className="text-lg" />
          </div>
          <TimeBar remainingMs={round.remainingMs} totalMs={round.totalMs} className="h-1" />
        </section>
      )}
      {/* Always mounted, so screen readers announce the result the moment it arrives. */}
      <div
        role="status"
        aria-live="polite"
        data-kind={showResult ? result.kind : undefined}
        className={
          showResult
            ? `rounded-xl border px-4 py-3 text-center text-base font-semibold shadow-lg shadow-black/40 motion-safe:animate-banner-in motion-reduce:animate-fade-in ${resultTones[result.kind]}`
            : undefined
        }
      >
        {showResult && result.text}
      </div>
    </div>
  )
}
