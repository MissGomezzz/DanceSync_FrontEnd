import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

/**
 * UI-facing view of the WebRTC mesh. The RTCPeerConnections themselves live in
 * the peer session; only what the stage renders is mirrored here.
 */
interface PeerState {
  /** Remote camera stream per player id. */
  remoteStreams: Record<string, MediaStream>
  /** Connection state per player id, for placeholders such as "Connecting...". */
  connectionStates: Record<string, RTCPeerConnectionState>
  setRemoteStream: (playerId: string, stream: MediaStream | null) => void
  setConnectionState: (playerId: string, state: RTCPeerConnectionState | null) => void
  reset: () => void
}

function withEntry<T>(record: Record<string, T>, key: string, value: T | null): Record<string, T> {
  if (value === null) {
    if (!(key in record)) return record
    const next = { ...record }
    delete next[key]
    return next
  }
  if (record[key] === value) return record
  return { ...record, [key]: value }
}

export const usePeerStore = create<PeerState>((set) => ({
  remoteStreams: {},
  connectionStates: {},
  setRemoteStream: (playerId, stream) =>
    set((state) => ({ remoteStreams: withEntry(state.remoteStreams, playerId, stream) })),
  setConnectionState: (playerId, connectionState) =>
    set((state) => ({ connectionStates: withEntry(state.connectionStates, playerId, connectionState) })),
  reset: () => set({ remoteStreams: {}, connectionStates: {} }),
}))

// These selectors build a fresh array on every call, so they go through
// useShallow: the component re-renders only when one of the entries changes.

/** Remote stream of each requested player, in the same order; null until it arrives. */
export const useRemoteStreams = (playerIds: readonly string[]) =>
  usePeerStore(useShallow((state) => playerIds.map((id) => state.remoteStreams[id] ?? null)))

/** Connection state with each requested player, in the same order; null when there is none. */
export const usePeerConnectionStates = (playerIds: readonly string[]) =>
  usePeerStore(useShallow((state) => playerIds.map((id) => state.connectionStates[id] ?? null)))
