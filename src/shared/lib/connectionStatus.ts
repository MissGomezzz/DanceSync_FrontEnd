import { create } from 'zustand'

/** State of the real-time connection to battle-service, as last reported by the socket. */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

interface ConnectionState {
  status: ConnectionStatus
  setStatus: (status: ConnectionStatus) => void
}

/**
 * Kept apart from the socket singleton so components (and tests that mock the
 * socket module) can read the status without opening a connection.
 */
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'connecting',
  setStatus: (status) => set({ status }),
}))

export const useConnectionStatus = () => useConnectionStore((state) => state.status)
