import { ordinal } from '../../../shared/lib/standings'
import type { Standing } from '../../../shared/types'

interface LastBattleCardViewProps {
  /** Final ranking of the previous battle, sorted by rank. */
  standings: Standing[]
  /** Winning dancer id, or null on a draw. */
  winnerId: string | null
}

/** Compact summary of the previous battle, shown in the lobby after a rematch. */
export function LastBattleCardView({ standings, winnerId }: LastBattleCardViewProps) {
  const winner = standings.find((s) => s.dancerId === winnerId)
  return (
    <section
      aria-labelledby="last-battle-heading"
      className="flex flex-col gap-2 rounded-2xl border border-sun/40 bg-surface p-4 shadow-soft"
    >
      <h2 id="last-battle-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Last battle
      </h2>
      <p className="font-semibold text-sun-strong">
        {winnerId === null ? 'It was a tie!' : `Winner: ${winner?.displayName ?? 'Former dancer'}`}
      </p>
      <ol className="flex flex-col gap-1 text-sm" aria-label="Last battle ranking">
        {standings.map((s) => (
          <li key={s.dancerId} className="flex justify-between gap-2">
            <span className="truncate text-ink">
              <span className="mr-2 text-ink-soft">{ordinal(s.rank)}</span>
              {s.displayName}
            </span>
            <span className="tabular-nums text-ink-muted">{s.score} pts</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
