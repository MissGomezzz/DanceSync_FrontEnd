import type { SubmitWordOutcome, WordRaceBanner, WordRoundEndedEvent } from '../types'

export interface OutcomeMessageInput {
  myId: string | null
  /** True for the battle's dancers, false for spectators. */
  isDancer: boolean
  /** Ack of my own correct submission for this round, if any ('late' changes the copy). */
  outcome: SubmitWordOutcome | null
  ended: WordRoundEndedEvent
}

/** Maps the end of a round to the banner each viewer sees. */
export function outcomeMessage({ myId, isDancer, outcome, ended }: OutcomeMessageInput): WordRaceBanner {
  const base = { winnerName: ended.winnerName, word: ended.word }
  if (ended.reason === 'expired' || ended.winnerId === null) {
    return { ...base, kind: 'expired', text: `Time's up! Nobody typed "${ended.word}".` }
  }
  const winner = ended.winnerName ?? 'Another dancer'
  if (myId !== null && ended.winnerId === myId) {
    const bonus = ended.bonusPoints ?? 0
    const text = bonus > 0 ? `You were first! +${bonus} bonus ${bonus === 1 ? 'point' : 'points'}.` : 'You were first! You win this round.'
    return { ...base, kind: 'won', text }
  }
  if (!isDancer) {
    return { ...base, kind: 'watching', text: `${winner} typed it first!` }
  }
  if (outcome === 'late') {
    return { ...base, kind: 'late', text: `You typed it, but ${winner} got there first.` }
  }
  return { ...base, kind: 'lost', text: `Too slow! ${winner} typed it first.` }
}
