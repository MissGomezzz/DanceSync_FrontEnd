import type { Player } from '../../../shared/types'

interface StartHintInput {
  /** The viewer is the host, who is the one pressing "Start battle". */
  isHost: boolean
  /** The viewer's player id, so the hint says "you" instead of their own name. */
  myId: string | undefined
  /** Display name of the host; null when the host is not in the player list. */
  hostName: string | null
  dancerCount: number
  minDancers: number
  /** The song challenge is running (typing the phrase or choosing the song). */
  choosingSong: boolean
  /** A song is already chosen, so only the battle itself is left to start. */
  songChosen: boolean
  /** Players who have not marked themselves ready. */
  waitingFor: Player[]
}

/**
 * Why the battle is not starting, in words every player in the lobby can act
 * on. Null when there is nothing to explain: the host can press "Start battle",
 * or the song challenge on screen already tells the story.
 */
export function startHint(input: StartHintInput): string | null {
  const { isHost, hostName, choosingSong, songChosen } = input
  const blocker = startBlocker(input)
  if (blocker) {
    // The song is picked but someone took back "ready" or changed role: without
    // this, the lobby looks stuck to everyone but the host.
    return songChosen ? `The song is chosen, but the battle can't start yet. ${blocker}` : blocker
  }
  if (choosingSong || isHost) return null
  return `Waiting for ${hostName ?? 'the host'} to start the battle.`
}

/** What keeps "Start battle" disabled, or null when nothing does. */
function startBlocker({ isHost, myId, dancerCount, minDancers, choosingSong, waitingFor }: StartHintInput): string | null {
  if (dancerCount < minDancers) return `At least ${minDancers} players must choose "Dance" to start.`
  if (choosingSong) return isHost ? 'Wait until the song has been chosen.' : null
  if (waitingFor.length > 0) return `Waiting for ${nameList(waitingFor, myId)} to be ready.`
  return null
}

/** "you", "Ana and Ben", "you, Ana and Ben": the viewer first, as "you". */
function nameList(players: Player[], myId: string | undefined): string {
  const names = [
    ...(players.some((player) => player.id === myId) ? ['you'] : []),
    ...players.filter((player) => player.id !== myId).map((player) => player.displayName),
  ]
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
