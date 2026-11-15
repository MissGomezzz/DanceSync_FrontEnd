import { create } from 'zustand'

/**
 * State of the real-time connection to battle-service, as last reported by the socket.
 * `blocked` (SEG-3): the server refuses this client for a while because it sent
 * too many events too fast.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'blocked'

interface ConnectionState {
  status: ConnectionStatus
  /** While `blocked`: performance.now() timestamp at which the server lets the client back. */
  blockedUntil: number | null
  /** performance.now() timestamp until which the "slow down" notice is shown (SEG-3). */
  slowDownUntil: number | null
  setStatus: (status: ConnectionStatus) => void
  /** The server blocked this client for `retryAfterMs`. */
  setBlocked: (retryAfterMs: number) => void
  /** Some events were dropped by the server's rate limit: tell the user for `forMs`. */
  setSlowDown: (forMs: number) => void
}

/**
 * Kept apart from the socket singleton so components (and tests that mock the
 * socket module) can read the status without opening a connection.
 */
export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'connecting',
  blockedUntil: null,
  slowDownUntil: null,
  setStatus: (status) => set({ status, blockedUntil: status === 'blocked' ? get().blockedUntil : null }),
  setBlocked: (retryAfterMs) => set({ status: 'blocked', blockedUntil: performance.now() + Math.max(0, retryAfterMs) }),
  setSlowDown: (forMs) => {
    const until = performance.now() + forMs
    set({ slowDownUntil: until })
    setTimeout(() => {
      if (get().slowDownUntil === until) set({ slowDownUntil: null })
    }, forMs)
  },
}))

export const useConnectionStatus = () => useConnectionStore((state) => state.status)

/** Milliseconds the server still refuses this client (0 when it is not blocked). */
export function remainingBlockMs(): number {
  const { status, blockedUntil } = useConnectionStore.getState()
  if (status !== 'blocked' || blockedUntil === null) return 0
  return Math.max(0, blockedUntil - performance.now())
}
