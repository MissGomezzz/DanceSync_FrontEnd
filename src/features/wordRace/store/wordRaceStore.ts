import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { emitWithAck } from '../../../shared/lib/socket'
import { outcomeMessage } from '../lib/outcomeMessage'
import type {
  SubmitWordOutcome,
  WordRaceBanner,
  WordRoundEndedEvent,
  WordRoundStartedEvent,
  WordSubmitResult,
} from '../types'

/** How long the end-of-round banner stays on screen. */
export const RESULT_VISIBLE_MS = 3500

export interface ActiveWordRound {
  roomCode: string
  roundId: string
  word: string
  roundNumber: number
  totalRounds: number
  /**
   * performance.now() timestamp at which the round closes, derived from the
   * server's relative `expiresInMs` so a skewed wall clock does not matter.
   */
  deadline: number
  /** Round length as first received, for the progress bar. */
  totalMs: number
}

/** Who is looking at the screen when a round ends; decides the banner copy. */
export interface WordRaceViewer {
  myId: string | null
  isDancer: boolean
}

interface WordRaceState {
  activeRound: ActiveWordRound | null
  /** A submission is waiting for the server's verdict. */
  submitting: boolean
  lastAttempt: 'incorrect' | null
  /** Verdict of my last submission, kept so a late ack can still refine the banner. */
  myOutcome: { roundId: string; outcome: SubmitWordOutcome } | null
  /** Last ended round and who saw it, used to (re)compute the banner. */
  ended: { event: WordRoundEndedEvent; viewer: WordRaceViewer } | null
  result: WordRaceBanner | null
  wins: Record<string, number>
  roundStarted: (event: WordRoundStartedEvent) => void
  roundEnded: (event: WordRoundEndedEvent, viewer: WordRaceViewer) => void
  submitWord: (text: string, playerId: string) => Promise<void>
  clearAttempt: () => void
  reset: () => void
}

type WordRaceData = Pick<
  WordRaceState,
  'activeRound' | 'submitting' | 'lastAttempt' | 'myOutcome' | 'ended' | 'result' | 'wins'
>

const initialState: WordRaceData = {
  activeRound: null,
  submitting: false,
  lastAttempt: null,
  myOutcome: null,
  ended: null,
  result: null,
  wins: {},
}

let resultTimer: ReturnType<typeof setTimeout> | undefined

function clearResultTimer(): void {
  if (resultTimer !== undefined) clearTimeout(resultTimer)
  resultTimer = undefined
}

export const useWordRaceStore = create<WordRaceState>((set, get) => {
  /** Shows the banner and hides it again after RESULT_VISIBLE_MS. */
  const showResult = (result: WordRaceBanner) => {
    clearResultTimer()
    set({ result })
    resultTimer = setTimeout(() => {
      resultTimer = undefined
      set({ result: null })
    }, RESULT_VISIBLE_MS)
  }

  return {
    ...initialState,

    roundStarted: (event) => {
      const deadline = performance.now() + event.expiresInMs
      const current = get().activeRound
      if (current?.roundId === event.roundId) {
        // Same round sent again after a rejoin: only refresh the time left.
        set({ activeRound: { ...current, deadline } })
        return
      }
      clearResultTimer()
      set({
        activeRound: {
          roomCode: event.roomCode,
          roundId: event.roundId,
          word: event.word,
          roundNumber: event.roundNumber,
          totalRounds: event.totalRounds,
          deadline,
          totalMs: event.expiresInMs,
        },
        submitting: false,
        lastAttempt: null,
        myOutcome: null,
        result: null,
      })
    },

    roundEnded: (event, viewer) => {
      const { activeRound, myOutcome } = get()
      set({
        activeRound: activeRound?.roundId === event.roundId ? null : activeRound,
        lastAttempt: null,
        wins: event.wins,
        ended: { event, viewer },
      })
      const outcome = myOutcome?.roundId === event.roundId ? myOutcome.outcome : null
      showResult(outcomeMessage({ ...viewer, outcome, ended: event }))
    },

    submitWord: async (text, playerId) => {
      const round = get().activeRound
      if (!round || get().submitting) return
      set({ submitting: true, lastAttempt: null })
      try {
        const { outcome } = await emitWithAck<WordSubmitResult>('word:submit', {
          roomCode: round.roomCode,
          playerId,
          roundId: round.roundId,
          text,
        })
        set({
          submitting: false,
          lastAttempt: outcome === 'incorrect' ? 'incorrect' : null,
          myOutcome: { roundId: round.roundId, outcome },
        })
        // The round-ended broadcast usually arrives before this ack; refine its banner
        // so a correct-but-late dancer reads "You typed it, but ..." instead of "Too slow!".
        const { ended } = get()
        if (ended?.event.roundId === round.roundId && outcome === 'late') {
          showResult(outcomeMessage({ ...ended.viewer, outcome, ended: ended.event }))
        }
      } catch {
        // Rejected (for example the round already closed); the round-ended event explains it.
        set({ submitting: false })
      }
    },

    clearAttempt: () => set({ lastAttempt: null }),

    reset: () => {
      clearResultTimer()
      set(initialState)
    },
  }
})

export const useActiveWordRound = () => useWordRaceStore((state) => state.activeRound)
export const useWordRaceResult = () => useWordRaceStore((state) => state.result)
export const useWordRaceWins = () => useWordRaceStore((state) => state.wins)
export const useWordRaceAttempt = () =>
  useWordRaceStore(useShallow((state) => ({ submitting: state.submitting, lastAttempt: state.lastAttempt })))
