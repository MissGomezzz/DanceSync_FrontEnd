/**
 * Wire shapes shared with battle-service.
 * Dates travel as ISO strings over JSON, so every timestamp is typed as string.
 */

export type PlayerRole = 'undecided' | 'dancer' | 'spectator'

export type RoomStatus = 'waiting' | 'battling' | 'finished'

export interface Player {
  id: string
  displayName: string
  role: PlayerRole
}

export interface Rating {
  raterId: string
  dancerId: string
  /** Integer score in the range 1 to 5. */
  score: number
  submittedAt: string
}

export interface BattleResult {
  /** Total score per dancer id. */
  scores: Record<string, number>
  /** Winning dancer id, or null on a tie. */
  winnerId: string | null
}

export interface Battle {
  id: string
  roomCode: string
  dancerIds: string[]
  ratings: Rating[]
  startedAt: string
  finishedAt: string | null
  result: BattleResult | null
}

export interface Room {
  code: string
  hostId: string
  players: Player[]
  dancers: Player[] | null
  spectators: Player[]
  status: RoomStatus
  battle: Battle | null
  createdAt: string
}

export interface ChatMessage {
  id: string
  roomCode: string
  senderId: string
  senderName: string
  content: string
  sentAt: string
}

export interface DomainErrorPayload {
  code: string
  message: string
}