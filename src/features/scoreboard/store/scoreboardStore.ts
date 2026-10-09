import { create } from 'zustand'
import { formatDelta, ordinal } from '../../../shared/lib/standings'
import type { Standing } from '../../../shared/types'

/** How long a row shows its `+N` / `−N` chip and its rank arrow. */
export const CHANGE_VISIBLE_MS = 2000

export interface ScoreChange {
  /** Points gained (positive) or lost (negative); 0 when only the rank moved. */
  delta: number
  /** The dancer climbed ('up') or dropped ('down') in the ranking; null when the rank held. */
  rankMove: 'up' | 'down' | null
  /** Identifies this change, so an older timer never hides a newer chip. */
  seq: number
}

interface ScoreboardState {
  /** Battle the baseline belongs to; standings of another battle start a new baseline. */
  battleId: string | null
  /** Last standings seen, per dancer id, to diff the next ones against. */
  previous: Record<string, { score: number; rank: number }>
  /** Visible changes per dancer id; each one disappears after CHANGE_VISIBLE_MS. */
  changes: Record<string, ScoreChange>
  /** Text for the polite live region, for example "Ana +2, now 1st". */
  announcement: string
  /**
   * Diffs `standings` against the previous ones of the same battle. The first
   * standings of a battle are only the baseline: a refresh shows no chips.
   */
  applyStandings: (battleId: string, standings: Standing[]) => void
  reset: () => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
let seq = 0

function clearTimers(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

function baseline(standings: Standing[]): ScoreboardState['previous'] {
  return Object.fromEntries(standings.map((s) => [s.dancerId, { score: s.score, rank: s.rank }]))
}

export const useScoreboardStore = create<ScoreboardState>((set, get) => {
  const expire = (dancerId: string, changeSeq: number) => {
    timers.delete(dancerId)
    const { changes } = get()
    if (changes[dancerId]?.seq !== changeSeq) return
    const rest = { ...changes }
    delete rest[dancerId]
    set({ changes: rest })
  }

  return {
    battleId: null,
    previous: {},
    changes: {},
    announcement: '',

    applyStandings: (battleId, standings) => {
      const state = get()
      if (state.battleId !== battleId) {
        clearTimers()
        set({ battleId, previous: baseline(standings), changes: {}, announcement: '' })
        return
      }

      const fresh: Record<string, ScoreChange> = {}
      const spoken: string[] = []
      for (const standing of standings) {
        const before = state.previous[standing.dancerId]
        if (!before) continue
        const delta = standing.score - before.score
        const rankMove = standing.rank < before.rank ? 'up' : standing.rank > before.rank ? 'down' : null
        if (delta === 0 && rankMove === null) continue
        fresh[standing.dancerId] = { delta, rankMove, seq: ++seq }
        if (delta !== 0) spoken.push(`${standing.displayName} ${formatDelta(delta)}, now ${ordinal(standing.rank)}`)
      }

      const previous = baseline(standings)
      if (Object.keys(fresh).length === 0) {
        // Same scores again (a room update about something else): nothing to show.
        set({ previous })
        return
      }

      // Rows of dancers who left disappear, and so do their chips.
      const kept = Object.fromEntries(Object.entries(state.changes).filter(([id]) => id in previous))
      set({
        previous,
        changes: { ...kept, ...fresh },
        announcement: spoken.length > 0 ? spoken.join('. ') : state.announcement,
      })
      for (const [dancerId, change] of Object.entries(fresh)) {
        const pending = timers.get(dancerId)
        if (pending !== undefined) clearTimeout(pending)
        timers.set(dancerId, setTimeout(() => expire(dancerId, change.seq), CHANGE_VISIBLE_MS))
      }
    },

    reset: () => {
      clearTimers()
      set({ battleId: null, previous: {}, changes: {}, announcement: '' })
    },
  }
})

export const useScoreChanges = () => useScoreboardStore((state) => state.changes)
export const useScoreAnnouncement = () => useScoreboardStore((state) => state.announcement)
