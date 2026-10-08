/** Wire shapes of the battle-service word race events. */

/**
 * Server verdict on a typed word.
 * won: first correct submission; late: correct, but another dancer won first;
 * incorrect: typo, the dancer may try again; expired: sent after the round closed.
 */
export type SubmitWordOutcome = 'won' | 'late' | 'incorrect' | 'expired'

export interface WordRoundStartedEvent {
  roomCode: string
  roundId: string
  roundNumber: number
  totalRounds: number
  word: string
  /** Time left in the round, computed by the server (never compare clocks). */
  expiresInMs: number
}

export interface WordRoundEndedEvent {
  roomCode: string
  roundId: string
  roundNumber: number
  totalRounds: number
  word: string
  winnerId: string | null
  winnerName: string | null
  reason: 'won' | 'expired'
  /** Rounds won so far per dancer id. */
  wins: Record<string, number>
  /** Bonus points the winner earned for this round; 0 or absent when nobody won it. */
  bonusPoints?: number
}

export interface WordSubmitResult {
  outcome: SubmitWordOutcome
  winnerId: string | null
}

/** won: I won; lost / late: another dancer won; watching: spectator view; expired: nobody won. */
export type WordRaceBannerKind = 'won' | 'lost' | 'late' | 'watching' | 'expired'

export interface WordRaceBanner {
  kind: WordRaceBannerKind
  text: string
  winnerName: string | null
  word: string
}
