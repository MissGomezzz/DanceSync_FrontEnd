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

export interface Song {
  id: string
  title: string
  artist: string
  durationSeconds: number
}

/** typing: phrase on screen; choosing: the winner picks a song; done: song picked. */
export type SongSelectionPhase = 'typing' | 'choosing' | 'done'

/** How the chooser got the privilege: typed the phrase first, or by fallback. */
export type ChooserReason = 'typed' | 'timeout' | 'all-failed' | 'chooser-left'

export interface SongChallenge {
  id: string
  phrase: string
  startedAt: string
  expiresAt: string
}

export interface SongSelection {
  phase: SongSelectionPhase
  challenge: SongChallenge
  /** Dancers allowed to type, fixed when the challenge starts. */
  participantIds: string[]
  /** Participants whose submission was rejected this round. */
  failedIds: string[]
  chooserId: string | null
  chooserReason: ChooserReason | null
  songOptions: Song[]
}

/** Server verdict on a typed phrase. */
export type SongSubmitOutcome = 'accepted' | 'incorrect' | 'expired'

export interface Battle {
  id: string
  roomCode: string
  dancerIds: string[]
  song: Song | null
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
  songSelection: SongSelection | null
  selectedSong: Song | null
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