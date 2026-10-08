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
  /** Marked "ready to dance" in the lobby; absent on servers that predate the ready button. */
  ready?: boolean
}

export interface Rating {
  raterId: string
  dancerId: string
  /** Integer score in the range 1 to 5. */
  score: number
  submittedAt: string
}

export interface BattleResult {
  /** Total score per dancer id: the spectators' ratings plus the word race bonus. */
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
  /** Absolute end of the typing window; only a fallback, it depends on clocks agreeing. */
  expiresAt: string
  /**
   * Time left in the typing window when the server emitted this room. Preferred
   * over `expiresAt` (no clock skew); optional until every server sends it.
   */
  expiresInMs?: number
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
  /**
   * Time left for the chooser to pick a song while the phase is "choosing", when
   * the server emitted this room; at zero the server picks a random song.
   * Null outside that phase; absent on servers that predate the pick deadline.
   */
  chooseExpiresInMs?: number | null
  /** True when the server picked the song because the chooser ran out of time. */
  autoPicked?: boolean
}

/** Server verdict on a typed phrase. */
export type SongSubmitOutcome = 'accepted' | 'incorrect' | 'expired'

export interface Battle {
  id: string
  roomCode: string
  /**
   * Dancers still in the battle. A dancer who leaves is removed: with two or more
   * left the battle goes on, otherwise it finishes early with `result: null`.
   */
  dancerIds: string[]
  song: Song | null
  /** Every rating submitted, including those for a dancer who left (excluded from the result). */
  ratings: Rating[]
  /**
   * Bonus points per dancer id for word race words typed first; added to the
   * ratings in the final result. Absent on servers that predate the bonus.
   */
  bonusPoints?: Record<string, number>
  startedAt: string
  finishedAt: string | null
  /**
   * Null when the battle finished without a rating result: too few dancers left,
   * or the song ended before the ratings were in.
   */
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
  /** Server-side optimistic concurrency counter; not used by the UI. */
  version?: number
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
  /** For example ROOM_NOT_FOUND, ROOM_NOT_WAITING, INVALID_PLAYER (bad join input) or TIMEOUT (client-side). */
  code: string
  message: string
}