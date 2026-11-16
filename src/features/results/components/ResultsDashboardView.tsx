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
  gold: 'border-sun bg-sun-soft text-sun-strong',
  silver: 'border-slate-300 bg-slate-100 text-slate-600',
  bronze: 'border-orange-300 bg-orange-50 text-orange-700',
  neutral: 'border-line bg-surface-muted text-ink-muted',
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
      // A container: the table drops its last column by the width of the dashboard itself.
      className="@container flex flex-col gap-4 rounded-2xl border border-line bg-surface p-3 shadow-soft sm:p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="results-heading" className="text-lg font-bold text-ink">
          Final results
        </h2>
        {endReason && <p className="text-sm text-ink-muted">{endReason}</p>}
      </header>

      {standings && standings.length > 0 ? (
        <Results standings={standings} winnerId={winnerId} myId={myId} />
      ) : (
        <p className="text-sm text-ink-muted">
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
    id === myId ? <span className="ml-1 shrink-0 text-xs font-semibold text-accent-strong">(you)</span> : null

  return (
    <>
      <p className="text-gradient-brand w-fit text-xl font-extrabold">
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
                  leader ? 'shadow-soft ring-2 ring-sun ring-offset-2 ring-offset-surface' : ''
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

      {/* Fixed numeric columns and a truncating name: the table fits a phone without scrolling sideways. */}
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Final ranking</caption>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
            <th scope="col" className="w-12 py-1 pr-1 pl-2 font-medium">
              Rank
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Dancer
            </th>
            <th scope="col" className="w-14 px-1 py-1 text-right font-medium">
              Votes
            </th>
            <th scope="col" className="w-14 px-1 py-1 text-right font-medium">
              Words
            </th>
            <th scope="col" className="w-16 px-2 py-1 text-right font-medium">
              Score
            </th>
            {/* The gap is the score again, relative to the leader: shown only when there is room. */}
            <th scope="col" className="hidden w-20 px-2 py-1 text-right font-medium @md:table-cell">
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
                className={`border-t border-line ${leader ? 'bg-sun-soft font-semibold text-sun-strong' : 'text-ink'}`}
              >
                <td className="py-2 pr-1 pl-2">{ordinal(standing.rank)}</td>
                <td className="px-2 py-2">
                  <span className="flex min-w-0 items-center">
                    <span className="truncate" title={standing.displayName}>
                      {standing.displayName}
                    </span>
                    {you(standing.dancerId)}
                  </span>
                </td>
                <td className="px-1 py-2 text-right tabular-nums">{standing.votes}</td>
                <td className="px-1 py-2 text-right tabular-nums">{standing.wordsWon}</td>
                <td className="px-2 py-2 text-right tabular-nums">{standing.score}</td>
                <td className="hidden px-2 py-2 text-right tabular-nums text-ink-muted @md:table-cell">
                  {gap === 0 ? 'Leader' : `−${gap} pts`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
