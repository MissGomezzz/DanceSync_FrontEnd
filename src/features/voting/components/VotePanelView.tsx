import type { BattleDancer } from '../../../shared/types'

interface VotePanelViewProps {
  dancers: BattleDancer[]
  /** Dancer this spectator votes for, or null. */
  myVoteId: string | null
  /** Why voting is not possible right now (dancer, before the start, after the end); null when it is. */
  disabledReason: string | null
  /** "Votes close in Ns"; null when the server sent no deadline. */
  timing?: string | null
  /** A vote is waiting for the server. */
  pending: boolean
  error: string | null
  onVote: (dancerId: string) => void
}

export function VotePanelView({
  dancers,
  myVoteId,
  disabledReason,
  timing = null,
  pending,
  error,
  onVote,
}: VotePanelViewProps) {
  const myVote = dancers.find((dancer) => dancer.id === myVoteId) ?? null
  const disabled = disabledReason !== null || pending

  return (
    <section aria-labelledby="vote-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <h2 id="vote-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Vote for your favourite
      </h2>

      {disabledReason ? (
        <p className="text-sm font-medium text-sun-strong">{disabledReason}</p>
      ) : (
        <p className="text-xs text-ink-soft">
          Tap a dancer to vote, another one to move your vote, or yours again to withdraw it.
        </p>
      )}
      {!disabledReason && timing && <p className="text-sm font-medium text-sun-strong">{timing}</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Dancers">
        {dancers.map((dancer) => {
          const selected = dancer.id === myVoteId
          return (
            <button
              key={dancer.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onVote(dancer.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-line bg-surface text-ink hover:border-primary/40 hover:bg-primary-soft'
              }`}
            >
              {dancer.displayName}
            </button>
          )
        })}
      </div>

      <p className="text-sm text-ink-muted" aria-live="polite">
        {myVote ? (
          <>
            Your vote: <span className="font-semibold text-primary-strong">{myVote.displayName}</span>
          </>
        ) : (
          !disabledReason && 'You have not voted yet.'
        )}
      </p>

      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </section>
  )
}
