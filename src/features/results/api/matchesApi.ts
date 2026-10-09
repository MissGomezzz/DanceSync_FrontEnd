import { httpClient } from '../../../shared/api/httpClient'
import { rankEntries } from '../../../shared/lib/standings'
import type { BattleEndReason, PlayerRole, Standing } from '../../../shared/types'

/** A player's line in a stored match (users-service, `match_participants`). */
export interface MatchParticipant {
  playerId: string
  displayName: string
  role?: PlayerRole
  votes: number
  wordsWon: number
  score: number
  rank?: number
  leftEarly?: boolean
}

/** A finished match as served by `GET /api/matches/{id}` through the gateway. */
export interface MatchRecord {
  /** Same id as the battle. */
  id: string
  roomCode?: string
  songTitle?: string | null
  finishedAt?: string | null
  /** Winning player id, or null on a draw. */
  winnerPlayerId: string | null
  endReason?: BattleEndReason | null
  participants: MatchParticipant[]
}

export interface MatchResults {
  standings: Standing[]
  winnerId: string | null
  endReason: BattleEndReason | null
}

/** Turns a stored match into the same shape the room payload carries. */
export function toMatchResults(match: MatchRecord): MatchResults {
  const dancers = match.participants.filter((p) => p.role === undefined || p.role === 'dancer')
  const entries = dancers.map((p) => ({
    dancerId: p.playerId,
    displayName: p.displayName,
    votes: p.votes,
    wordsWon: p.wordsWon,
    score: p.score,
  }))
  const allRanked = dancers.every((p) => typeof p.rank === 'number')
  const standings = allRanked
    ? dancers
        .map((p, i) => ({ ...entries[i], rank: p.rank as number }))
        .sort((a, b) => a.rank - b.rank || a.displayName.localeCompare(b.displayName))
    : rankEntries(entries)
  return { standings, winnerId: match.winnerPlayerId ?? null, endReason: match.endReason ?? null }
}

/** Final results of a battle, for a client that has no standings in memory (for example after a refresh). */
export async function fetchMatchResults(matchId: string, signal?: AbortSignal): Promise<MatchResults> {
  const match = await httpClient.get<MatchRecord>(`/api/matches/${encodeURIComponent(matchId)}`, { signal })
  return toMatchResults(match)
}
