import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { httpClient } from '../../../shared/api/httpClient'
import { emitWithAck, socket, SocketDomainError } from '../../../shared/lib/socket'
import type { ChatMessage, DomainErrorPayload, Player, Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'

export const MAX_PLAYERS = 8
export const MIN_PLAYERS_TO_START = 2

interface RoomState {
  /** The server room, stored verbatim. */
  room: Room | null
  error: string | null
  setRoom: (room: Room | null) => void
  setError: (error: string | null) => void
  clear: () => void
  /** Creates a room over HTTP, then joins it through the socket. Null on failure. */
  createRoom: (displayName: string) => Promise<Room | null>
  /** Joins (or idempotently rejoins) a room through the socket. Null on failure. */
  joinRoom: (roomCode: string) => Promise<Room | null>
  leaveRoom: () => Promise<void>
  /** Asks the server to start the battle; domain errors land in `error`. */
  startBattle: () => Promise<void>
}

function toErrorMessage(error: unknown): string {
  if (error instanceof SocketDomainError) return error.message
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  error: null,
  setRoom: (room) => set({ room }),
  setError: (error) => set({ error }),
  clear: () => {
    useChatStore.getState().clear()
    set({ room: null, error: null })
  },
  createRoom: async (displayName) => {
    const identity = useAuthStore.getState().setDisplayName(displayName)
    try {
      const created = await httpClient.post<Room>('/api/rooms', {
        hostId: identity.id,
        displayName: identity.displayName,
      })
      return await get().joinRoom(created.code)
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return null
    }
  },
  joinRoom: async (roomCode) => {
    const identity = useAuthStore.getState().ensureIdentity()
    initRoomSync()
    const code = roomCode.trim().toUpperCase()
    if (get().room?.code !== code) {
      useChatStore.getState().clear()
    }
    try {
      const room = await emitWithAck<Room>('room:join', {
        roomCode: code,
        playerId: identity.id,
        displayName: identity.displayName,
      })
      set({ room, error: null })
      return room
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return null
    }
  },
  leaveRoom: async () => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (room && identity) {
      try {
        await emitWithAck<Room | null>('room:leave', { roomCode: room.code, playerId: identity.id })
      } catch {
        // The room may already be gone; leaving locally is enough.
      }
    }
    get().clear()
  },
  startBattle: async () => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (!room || !identity) return
    try {
      const updated = await emitWithAck<Room>('battle:start', {
        roomCode: room.code,
        requesterId: identity.id,
      })
      set({ room: updated, error: null })
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
}))

let listenersBound = false

/**
 * Binds the server-to-client listeners exactly once for the app lifetime.
 * Called from every join flow so it is guaranteed to run before any event lands.
 */
export function initRoomSync(): void {
  if (listenersBound) return
  listenersBound = true
  const applyRoom = (room: Room) => useRoomStore.getState().setRoom(room)
  socket.on('room:updated', applyRoom)
  socket.on('battle:started', applyRoom)
  socket.on('battle:finished', applyRoom)
  socket.on('chat:message', (message: ChatMessage) => useChatStore.getState().addMessage(message))
  socket.on('error:domain', (error: DomainErrorPayload) => useRoomStore.getState().setError(error.message))
}

export const useRoom = () => useRoomStore((state) => state.room)
export const useRoomError = () => useRoomStore((state) => state.error)

/**
 * Selectors derived from the room. They build a new array on every call, so
 * components must consume them through the shallow-compared hooks below to
 * avoid infinite re-renders.
 */
const selectPlayers = (state: RoomState): Player[] => state.room?.players ?? []
const selectDancers = (state: RoomState): Player[] => state.room?.dancers ?? []
const selectSpectators = (state: RoomState): Player[] => state.room?.spectators ?? []

export const usePlayers = () => useRoomStore(useShallow(selectPlayers))
export const useDancers = () => useRoomStore(useShallow(selectDancers))
export const useSpectators = () => useRoomStore(useShallow(selectSpectators))
