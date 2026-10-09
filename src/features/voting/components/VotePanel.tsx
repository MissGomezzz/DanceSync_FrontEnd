import { useCountdown, useServerDeadline } from '../../../shared/hooks/useCountdown'
import { battleDancers } from '../../../shared/lib/standings'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoom } from '../../rooms/store/roomStore'
import { useMyVote, useVoteStore } from '../store/voteStore'
import { VotePanelView } from './VotePanelView'

const seconds = (ms: number) => Math.ceil(ms / 1000)

/**
 * Spectators vote for one favourite dancer and may move or withdraw the vote
 * until the song ends. Dancers see the panel disabled with the reason.
 */
export function VotePanel() {
  const room = useRoom()
  const myId = useAuthStore((state) => state.identity?.id)
  const vote = useMyVote()
  const castVote = useVoteStore((state) => state.castVote)

  const battle = room?.battle ?? null
  const running = room?.status === 'battling'
  // Both deadlines are server-relative and re-anchored on every room payload.
  const startsInMs = battle?.startsInMs
  const startDeadline = useServerDeadline(
    running && typeof startsInMs === 'number' && startsInMs > 0 ? startsInMs : null,
    battle,
  )
  const startsIn = useCountdown(startDeadline)
  const endDeadline = useServerDeadline(running ? (battle?.endsInMs ?? null) : null, battle)
  const closesIn = useCountdown(endDeadline)

  if (!room || !battle) return null

  const dancers = battleDancers(room)
  const finished = room.status === 'finished' || battle.finishedAt !== null
  const notStarted = !finished && startDeadline !== null && startsIn > 0
  const isDancer =
    myId !== undefined && (battle.dancerIds.includes(myId) || (room.dancers ?? []).some((d) => d.id === myId))
  const isSpectator = myId !== undefined && room.spectators.some((s) => s.id === myId)

  const disabledReason = isDancer
    ? "Dancers can't vote."
    : !isSpectator
      ? 'Only spectators can vote.'
      : finished
        ? 'Voting is closed: the battle is over.'
        : notStarted
          ? `Voting opens when the battle starts, in ${seconds(startsIn)}s.`
          : null
  const timing =
    endDeadline === null ? null : closesIn > 0 ? `Votes close in ${seconds(closesIn)}s` : 'Voting is closing...'

  // A vote for a dancer who left is discarded by the server; never show it.
  const myVoteId =
    vote.roomCode === room.code.toUpperCase() && dancers.some((dancer) => dancer.id === vote.dancerId)
      ? vote.dancerId
      : null

  const handleVote = (dancerId: string) => {
    if (!myId || disabledReason !== null || vote.pending) return
    // Tapping the selected dancer again withdraws the vote.
    void castVote(room.code, myId, dancerId === myVoteId ? null : dancerId)
  }

  return (
    <VotePanelView
      dancers={dancers}
      myVoteId={myVoteId}
      disabledReason={disabledReason}
      timing={timing}
      pending={vote.pending}
      error={vote.error}
      onVote={handleVote}
    />
  )
}
