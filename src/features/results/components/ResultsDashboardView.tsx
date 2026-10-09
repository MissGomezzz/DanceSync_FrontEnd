import type { ReactNode } from 'react'
import { leaderIds, ordinal, rankTone, type RankTone } from '../../../shared/lib/standings'
import type { Standing } from '../../../shared/types'

interface ResultsDashboardViewProps {
  /** Final ranking sorted by rank; null while it is loading or when there is none. */
  standings: Standing[] | null
  /** Winning dancer id, or null on a draw. */
  winnerId: string | null
  /** "The song ended", "Not enough dancers left"; null when unknown. */
  endReason: string | null
  /** The results are being fetched from the results endpoint. */
  loading?: boolean
  /** The results endpoint could not be reached. */
  failed?: boolean
  myId?: string | null
  /** Buttons under the dashboard (rematch, leave). */
  actions?: ReactNode
}

const podiumTones: Record<RankTone, string> = {
  gold: 'border-amber-400 bg-amber-400/15 text-amber-100',
  silver: 'border-slate-300 bg-slate-300/10 text-slate-100',
  bronze: 'border-orange-500 bg-orange-700/20 text-orange-100',
  neutral: 'border-slate-700 bg-slate-900 text-slate-300',
}

/** Podium steps: 1st in the middle and tallest, 2nd on the left, 3rd on the right. */
const podiumPlacement = ['sm:order-2 sm:pt-0', 'sm:order-1 sm:pt-6', 'sm:order-3 sm:pt-10']

export function ResultsDashboardView({
  standings,
  winnerId,
  endReason,
  loading = false,
  failed = false,
  myId = null,
  actions = null,
}: ResultsDashboardViewProps) {
  return (
    <section
      aria-labelledby="results-heading"
      className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="results-heading" className="text-lg font-bold">
          Final results
        </h2>
        {endReason && <p className="text-sm text-slate-400">{endReason}</p>}
      </header>

      {standings && standings.length > 0 ? (
        <Results standings={standings} winnerId={winnerId} myId={myId} />
      ) : (
        <p className="text-sm text-slate-400">
          {loading
            ? 'Loading the results...'
            : failed
              ? 'The results could not be loaded.'
              : 'The battle ended without a result.'}
        </p>
      )}

      {actions && <footer className="flex flex-wrap justify-end gap-3">{actions}</footer>}
    </section>
  )
}

function Results({ standings, winnerId, myId }: { standings: Standing[]; winnerId: string | null; myId: string | null }) {
  const leaders = new Set(leaderIds(standings, winnerId))
  const isDraw = winnerId === null
  const winner = standings.find((s) => s.dancerId === winnerId)
  const topScore = Math.max(...standings.map((s) => s.score))
  const you = (id: string) =>
    id === myId ? <span className="ml-1 text-xs font-semibold text-emerald-300">(you)</span> : null

  return (
    <>
      <p className="text-xl font-extrabold text-amber-300">
        {isDraw ? 'It is a tie!' : `Winner: ${winner?.displayName ?? 'Former dancer'}`}
      </p>

      <ol aria-label="Podium" className="grid gap-3 sm:grid-cols-3 sm:items-end">
        {standings.slice(0, 3).map((standing, index) => {
          const leader = leaders.has(standing.dancerId)
          return (
            <li
              key={standing.dancerId}
              data-winner={leader}
              className={`${podiumPlacement[index]} flex flex-col`}
            >
              <div
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-4 text-center ${podiumTones[rankTone(standing.rank)]} ${
                  leader ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950' : ''
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide">{ordinal(standing.rank)}</span>
                <span className="max-w-full truncate text-base font-bold">
                  {standing.displayName}
                  {you(standing.dancerId)}
                </span>
                <span className="text-sm tabular-nums">{standing.score} pts</span>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <caption className="sr-only">Final ranking</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-2 py-1 font-medium">
                Rank
              </th>
              <th scope="col" className="px-2 py-1 font-medium">
                Dancer
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Votes
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Words
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Score
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const leader = leaders.has(standing.dancerId)
              const gap = topScore - standing.score
              return (
                <tr
                  key={standing.dancerId}
                  data-winner={leader}
                  className={`border-t border-slate-800 ${leader ? 'bg-amber-400/10 font-semibold text-amber-100' : ''}`}
                >
                  <td className="px-2 py-2">{ordinal(standing.rank)}</td>
                  <td className="px-2 py-2">
                    {standing.displayName}
                    {you(standing.dancerId)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{standing.votes}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{standing.wordsWon}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{standing.score}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                    {gap === 0 ? 'Leader' : `−${gap} pts`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
