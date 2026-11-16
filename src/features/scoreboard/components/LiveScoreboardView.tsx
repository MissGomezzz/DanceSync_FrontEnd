import { formatDelta, ordinal, rankTone, type RankTone } from '../../../shared/lib/standings'
import type { Standing } from '../../../shared/types'
import type { ScoreChange } from '../store/scoreboardStore'

interface LiveScoreboardViewProps {
  /** Sorted by rank. */
  standings: Standing[]
  /** Visible score and rank changes per dancer id. */
  changes: Record<string, ScoreChange>
  /** Read out by screen readers when it changes ("Ana +2, now 1st"). */
  announcement: string
  myId?: string | null
}

/** Row colour per rank tone; transition-colors animates a rank change. */
const rankToneClasses: Record<RankTone, string> = {
  gold: 'bg-sun-soft text-sun-strong',
  silver: 'bg-slate-100 text-slate-600',
  bronze: 'bg-orange-50 text-orange-700',
  neutral: 'bg-surface-muted text-ink-muted',
}

/** Accent stripe at the start of each row, same tone as the row. */
const rankToneBorders: Record<RankTone, string> = {
  gold: 'border-sun',
  silver: 'border-slate-400',
  bronze: 'border-orange-400',
  neutral: 'border-line',
}

export function LiveScoreboardView({ standings, changes, announcement, myId = null }: LiveScoreboardViewProps) {
  return (
    <section
      aria-labelledby="live-ranking-heading"
      // A container: the table adapts to the width of the panel (a phone, the
      // 20rem sidebar), not to the width of the window.
      className="@container flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft"
    >
      <h2 id="live-ranking-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Live ranking
      </h2>
      {standings.length === 0 ? (
        <p className="text-sm text-ink-soft">The ranking appears when the battle starts.</p>
      ) : (
        <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
              <th scope="col" className="w-16 px-2 font-medium">
                Rank
              </th>
              {/* The only flexible column: it takes what the fixed ones leave and truncates. */}
              <th scope="col" className="px-2 font-medium">
                Dancer
              </th>
              <th scope="col" className="w-14 px-1 text-right font-medium">
                Votes
              </th>
              {/* The score already counts the words, so this column gives way on a narrow panel. */}
              <th scope="col" className="hidden w-14 px-1 text-right font-medium @sm:table-cell">
                Words
              </th>
              <th scope="col" className="w-18 px-2 text-right font-medium">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const tone = rankTone(standing.rank)
              const change = changes[standing.dancerId]
              return (
                <tr
                  key={standing.dancerId}
                  data-rank-tone={tone}
                  className={`transition-colors duration-700 ${rankToneClasses[tone]}`}
                >
                  <td
                    className={`rounded-l-lg border-l-4 px-2 py-2 font-semibold transition-colors duration-700 ${rankToneBorders[tone]}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {ordinal(standing.rank)}
                      {change?.rankMove && <RankArrow move={change.rankMove} />}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-medium">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate" title={standing.displayName}>
                        {standing.displayName}
                      </span>
                      {standing.dancerId === myId && (
                        <span className="shrink-0 text-xs font-semibold text-accent-strong">(you)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums">{standing.votes}</td>
                  <td className="hidden px-1 py-2 text-right tabular-nums @sm:table-cell">{standing.wordsWon}</td>
                  <td className="rounded-r-lg px-2 py-2 text-right font-bold tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1">
                      {change && change.delta !== 0 && <DeltaChip delta={change.delta} />}
                      {standing.score}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="text-xs text-ink-soft">A vote is worth 2 points, a word race round 1 point.</p>
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </section>
  )
}

function DeltaChip({ delta }: { delta: number }) {
  const up = delta > 0
  return (
    <span
      data-delta={up ? 'up' : 'down'}
      className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {formatDelta(delta)}
    </span>
  )
}

function RankArrow({ move }: { move: 'up' | 'down' }) {
  return (
    <span
      role="img"
      aria-label={move === 'up' ? 'moved up' : 'moved down'}
      className={move === 'up' ? 'text-emerald-700' : 'text-rose-700'}
    >
      {move === 'up' ? '▲' : '▼'}
    </span>
  )
}
