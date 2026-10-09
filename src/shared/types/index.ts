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

/**
 * One dancer's line in the ranking, computed by the server:
 * `score = VOTE_POINTS x votes + WORD_BONUS_POINTS x wordsWon` (2 and 1 by default).
 */
export interface Standing {
  dancerId: string
  displayName: string
  /** Spectators currently voting for this dancer. */
  votes: number
  /** Word race rounds this dancer won. */
  wordsWon: number
  score: number
  /** Competition ranking: equal scores share a rank (1, 1, 3). */
  rank: number
}

/** Why the battle finished: the song clip ended, or fewer than two dancers were left. */
export type BattleEndReason = 'song-end' | 'not-enough-dancers'

export interface BattleResult {
  /** Final ranking, sorted by rank. Absent on servers that predate live scoring. */
  standings?: Standing[]
  /** Winning dancer id, or null on a draw (a tie at the top). */
  winnerId: string | null
  /** Total score per dancer id; only sent by servers that predate `standings`. */
  scores?: Record<string, number>
}

export interface Song {
  id: string
  title: string
  artist: string
  durationSeconds: number
  youtubeId?: string
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

/** A dancer as recorded in the battle roster. */
export interface BattleDancer {
  id: string
  displayName: string
}

export interface Battle {
  id: string
  roomCode: string
  /**
   * Dancers still in the battle. A dancer who leaves is removed: with two or more
   * left the battle goes on, otherwise it finishes early with `result: null`.
   */
  dancerIds: string[]
  song: Song | null
  /**
   * The dancers when the battle started, kept even after one leaves, so the
   * result can still name them. Absent on older servers.
   */
  roster?: BattleDancer[]
  /**
   * Live ranking, sorted by rank, recomputed on every vote and word race win.
   * Absent on servers that predate live scoring.
   */
  standings?: Standing[]
  /** Votes per dancer id (totals only: who voted for whom never leaves the server). */
  voteCounts?: Record<string, number>
  /** Word race rounds won per dancer id. */
  wordsWon?: Record<string, number>
  /**
   * Older name of `wordsWon`, sent by servers that predate live scoring; read
   * only as a fallback.
   */
  bonusPoints?: Record<string, number>
  /** Why the battle finished; null while it runs, absent on older servers. */
  endReason?: BattleEndReason | null
  /** Absolute start of the battle (and of the song); only a fallback, it depends on clocks agreeing. */
  startedAt: string
  /**
   * `startedAt` minus the server's clock when it emitted this room: positive while
   * the battle is about to start, negative (elapsed time) once it is running.
   * Preferred over `startedAt` (no clock skew); absent on older servers.
   */
  startsInMs?: number
  /**
   * Time left, when the server emitted this room, until it finishes the battle on
   * its own at the end of the song. Null when there is no such deadline; absent
   * on older servers.
   */
  endsInMs?: number | null
  finishedAt: string | null
  /** Final result once the battle finished; null while it runs. */
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
  /**
   * Result of the previous battle, kept after a rematch so the lobby can show
   * it as "Last battle". Absent on older servers.
   */
  lastResult?: BattleResult | null
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
  /**
   * For example ROOM_NOT_FOUND, ROOM_NOT_WAITING, INVALID_PLAYER (bad join input),
   * INVALID_VOTER, BATTLE_FINISHED, NOT_HOST, ROOM_NOT_FINISHED or TIMEOUT (client-side).
   */
  code: string
  message: string
}
/** Payload of `vote:mine`: the spectator's own vote, sent only to them. */
export interface MyVotePayload {
  roomCode: string
  /** Dancer the spectator votes for, or null when they have no vote. */
  dancerId: string | null
}
