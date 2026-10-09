import type { Battle, BattleDancer, BattleResult, Room, Standing } from '../types'

/**
 * Default points of the scoring rule, used only to rebuild a ranking when the
 * server sends totals without `standings` (older servers). The server is the
 * source of truth: `score = VOTE_POINTS x votes + WORD_BONUS_POINTS x wordsWon`.
 */
export const VOTE_POINTS = 2
export const WORD_BONUS_POINTS = 1

/** Shown for a dancer who left and is in no list that still carries their name. */
export const FORMER_DANCER = 'Former dancer'

/**
 * Name lookup for every player and dancer of the room, including dancers who
 * left: later sources win, so the battle roster and the standings (snapshots
 * taken by the server) beat the live player list.
 */
export function nameResolver(room: Room): (id: string) => string {
  const names = new Map<string, string>()
  for (const player of room.players) names.set(player.id, player.displayName)
  for (const dancer of room.dancers ?? []) names.set(dancer.id, dancer.displayName)
  for (const dancer of room.battle?.roster ?? []) names.set(dancer.id, dancer.displayName)
  for (const standing of room.battle?.standings ?? []) names.set(standing.dancerId, standing.displayName)
  for (const standing of room.battle?.result?.standings ?? []) names.set(standing.dancerId, standing.displayName)
  return (id) => names.get(id) ?? FORMER_DANCER
}

/** Dancers still in the battle, in battle order, with their display names. */
export function battleDancers(room: Room): BattleDancer[] {
  const battle = room.battle
  if (!battle) return []
  const nameOf = nameResolver(room)
  return battle.dancerIds.map((id) => ({ id, displayName: nameOf(id) }))
}

/** Word race rounds won per dancer id; reads the older `bonusPoints` name as a fallback. */
export function wordsWonOf(battle: Battle | null | undefined): Record<string, number> {
  return battle?.wordsWon ?? battle?.bonusPoints ?? {}
}

/**
 * Competition ranking: sorted by score (then name, for a stable order), equal
 * scores share a rank (1, 1, 3).
 */
export function rankEntries(entries: Omit<Standing, 'rank'>[]): Standing[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
  return sorted.map((entry) => ({ ...entry, rank: sorted.findIndex((other) => other.score === entry.score) + 1 }))
}

function scoreOf(votes: number, wordsWon: number): number {
  return VOTE_POINTS * votes + WORD_BONUS_POINTS * wordsWon
}

/** Live ranking of the battle: the server's `standings`, or one rebuilt from the totals it sent. */
export function liveStandings(room: Room): Standing[] {
  const battle = room.battle
  if (!battle) return []
  if (battle.standings) return battle.standings
  const votes = battle.voteCounts ?? {}
  const words = wordsWonOf(battle)
  const nameOf = nameResolver(room)
  return rankEntries(
    battle.dancerIds.map((id) => {
      const entry = { dancerId: id, displayName: nameOf(id), votes: votes[id] ?? 0, wordsWon: words[id] ?? 0 }
      return { ...entry, score: scoreOf(entry.votes, entry.wordsWon) }
    }),
  )
}

/**
 * Final ranking of a result: its `standings`, or one rebuilt from the per-dancer
 * `scores` that older servers send. Null when the result carries neither.
 */
export function resultStandings(result: BattleResult | null | undefined, room: Room): Standing[] | null {
  if (!result) return null
  if (result.standings) return result.standings
  if (!result.scores) return null
  const scores = result.scores
  const votes = room.battle?.voteCounts ?? {}
  const words = wordsWonOf(room.battle)
  const nameOf = nameResolver(room)
  return rankEntries(
    Object.keys(scores).map((id) => ({
      dancerId: id,
      displayName: nameOf(id),
      votes: votes[id] ?? 0,
      wordsWon: words[id] ?? 0,
      score: scores[id] ?? 0,
    })),
  )
}

/** Dancers sharing the top rank: the winner, or every tied leader on a draw. */
export function leaderIds(standings: Standing[], winnerId: string | null): string[] {
  if (winnerId) return [winnerId]
  return standings.filter((standing) => standing.rank === 1).map((standing) => standing.dancerId)
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}

export type RankTone = 'gold' | 'silver' | 'bronze' | 'neutral'

/** Colour of a rank: 1st gold, 2nd silver, 3rd bronze, the rest neutral (tied dancers share a rank). */
export function rankTone(rank: number): RankTone {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'neutral'
}

/** Signed points with a real minus sign: +2, −1. */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`
}
