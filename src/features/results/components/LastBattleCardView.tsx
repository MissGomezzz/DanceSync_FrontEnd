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
      className="flex flex-col gap-2 rounded-xl border border-amber-400/30 bg-slate-900/60 p-4"
    >
      <h2 id="last-battle-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Last battle
      </h2>
      <p className="font-semibold text-amber-300">
        {winnerId === null ? 'It was a tie!' : `Winner: ${winner?.displayName ?? 'Former dancer'}`}
      </p>
      <ol className="flex flex-col gap-1 text-sm" aria-label="Last battle ranking">
        {standings.map((s) => (
          <li key={s.dancerId} className="flex justify-between gap-2">
            <span className="truncate">
              <span className="mr-2 text-slate-500">{ordinal(s.rank)}</span>
              {s.displayName}
            </span>
            <span className="tabular-nums text-slate-300">{s.score} pts</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
