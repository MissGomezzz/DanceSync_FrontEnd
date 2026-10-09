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
  gold: 'bg-amber-400/15 text-amber-100',
  silver: 'bg-slate-300/10 text-slate-100',
  bronze: 'bg-orange-700/20 text-orange-100',
  neutral: 'bg-slate-900 text-slate-300',
}

/** Accent stripe at the start of each row, same tone as the row. */
const rankToneBorders: Record<RankTone, string> = {
  gold: 'border-amber-400',
  silver: 'border-slate-300',
  bronze: 'border-orange-500',
  neutral: 'border-slate-700',
}

export function LiveScoreboardView({ standings, changes, announcement, myId = null }: LiveScoreboardViewProps) {
  return (
    <section
      aria-labelledby="live-ranking-heading"
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <h2 id="live-ranking-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Live ranking
      </h2>
      {standings.length === 0 ? (
        <p className="text-sm text-slate-500">The ranking appears when the battle starts.</p>
      ) : (
        <table className="w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-2 font-medium">
                Rank
              </th>
              <th scope="col" className="px-2 font-medium">
                Dancer
              </th>
              <th scope="col" className="px-1 text-right font-medium">
                Votes
              </th>
              <th scope="col" className="px-1 text-right font-medium">
                Words
              </th>
              <th scope="col" className="px-2 text-right font-medium">
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
                  <td className="max-w-[8rem] truncate px-2 py-2 font-medium">
                    {standing.displayName}
                    {standing.dancerId === myId && <span className="ml-1 text-xs text-emerald-300">(you)</span>}
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums">{standing.votes}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{standing.wordsWon}</td>
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
      <p className="text-xs text-slate-500">A vote is worth 2 points, a word race round 1 point.</p>
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
        up ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
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
      className={move === 'up' ? 'text-emerald-300' : 'text-rose-300'}
    >
      {move === 'up' ? '▲' : '▼'}
    </span>
  )
}
