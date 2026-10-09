import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { emitWithAck, SocketDomainError } from '../../../shared/lib/socket'
import type { MyVotePayload } from '../../../shared/types'

/** Plain-words explanation of each vote rejection; anything else shows the server's message. */
export const voteErrorMessages: Record<string, string> = {
  INVALID_VOTER: "Only spectators can vote. Dancers can't vote.",
  BATTLE_NOT_STARTED: 'The battle has not started yet. You can vote once the music begins.',
  BATTLE_FINISHED: 'The battle is over, so voting is closed.',
}

interface VoteState {
  /** Room the vote below belongs to; the UI never shows a vote from another room. */
  roomCode: string | null
  /** Dancer this spectator votes for, or null. Only the spectator knows it (vote privacy). */
  dancerId: string | null
  /** A vote:cast is waiting for the server; further taps are ignored meanwhile. */
  pending: boolean
  error: string | null
  /** Applies vote:mine (sent after each change and on rejoin); the caller filters other rooms. */
  receiveMine: (payload: MyVotePayload) => void
  /** Casts (dancerId), moves (another dancerId) or withdraws (null) the vote. */
  castVote: (roomCode: string, voterId: string, dancerId: string | null) => Promise<void>
  reset: () => void
}

const initialState = { roomCode: null, dancerId: null, pending: false, error: null }

function voteErrorMessage(error: unknown): string {
  const known = error instanceof SocketDomainError ? voteErrorMessages[error.code] : undefined
  return known ?? (error instanceof Error ? error.message : 'Could not register the vote.')
}

export const useVoteStore = create<VoteState>((set, get) => ({
  ...initialState,
  receiveMine: ({ roomCode, dancerId }) => set({ roomCode: roomCode.toUpperCase(), dancerId: dancerId ?? null }),
  castVote: async (roomCode, voterId, dancerId) => {
    if (get().pending) return
    const code = roomCode.toUpperCase()
    set({ pending: true, error: null })
    try {
      // The ack carries the voter's current vote; the new totals arrive through room:updated.
      const ack = await emitWithAck<{ dancerId: string | null } | null>('vote:cast', { roomCode: code, voterId, dancerId })
      const current = ack && 'dancerId' in ack ? ack.dancerId : dancerId
      set({ roomCode: code, dancerId: current ?? null, pending: false })
    } catch (error) {
      set({ pending: false, error: voteErrorMessage(error) })
    }
  },
  reset: () => set(initialState),
}))

export const useMyVote = () =>
  useVoteStore(
    useShallow((state) => ({
      roomCode: state.roomCode,
      dancerId: state.dancerId,
      pending: state.pending,
      error: state.error,
    })),
  )
