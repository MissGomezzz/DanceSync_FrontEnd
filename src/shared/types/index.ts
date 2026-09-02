export type PlayerRole = 'dancer' | 'spectator'

export interface Player {
  id: string
  displayName: string
  role: PlayerRole
}

export interface Room {
  id: string
  hostId: string
  players: Player[]
  createdAt: string
}

export type BattleStatus = 'idle' | 'countdown' | 'dancing' | 'finished'

export interface BattleScore {
  playerId: string
  points: number
}

export interface ChatMessage {
  id: string
  roomId: string
  authorId: string
  authorName: string
  content: string
  sentAt: string
}

export interface Rating {
  raterId: string
  dancerId: string
  /** Integer score in the range 1 to 5. */
  stars: number
}
