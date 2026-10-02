import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { httpClient } from '../../../shared/api/httpClient'
import { emitWithAck, socket, SocketDomainError } from '../../../shared/lib/socket'
import type { ChatMessage, DomainErrorPayload, Player, Room, SongSubmitOutcome } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'

export const MAX_PLAYERS = 7
export const MIN_PLAYERS_TO_START = 2

interface RoomState {
  room: Room | null
  error: string | null
  joinError: string | null
  setRoom: (room: Room | null) => void
  setError: (error: string | null) => void
  clear: () => void
  createRoom: (displayName: string) => Promise<Room | null>
  joinRoom: (roomCode: string) => Promise<Room | null>
  leaveRoom: () => Promise<void>
  selectRole: (role: 'dancer' | 'spectator') => Promise<void>
  startBattle: () => Promise<void>
  startSongChallenge: () => Promise<void>
  /** Returns the server verdict, or null when the submission could not be processed. */
  submitSongPhrase: (text: string) => Promise<SongSubmitOutcome | null>
  chooseSong: (songId: string) => Promise<void>
}

function toErrorMessage(error: unknown): string {
  if (error instanceof SocketDomainError) return error.message
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  error: null,
  joinError: null,
  setRoom: (room) => set({ room }),
  setError: (error) => set({ error }),
  clear: () => {
    useChatStore.getState().clear()
    set({ room: null, error: null, joinError: null })
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
    set({ joinError: null })
    try {
      const room = await emitWithAck<Room>('room:join', {
        roomCode: code,
        playerId: identity.id,
        displayName: identity.displayName,
      })
      set({ room, error: null, joinError: null })
      return room
    } catch (error) {
      set({ joinError: toErrorMessage(error) })
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
  selectRole: async (role) => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (!room || !identity) return
    try {
      const updated = await emitWithAck<Room>('role:select', {
        roomCode: room.code,
        playerId: identity.id,
        role,
      })
      set({ room: updated, error: null })
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
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
  startSongChallenge: async () => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (!room || !identity) return
    try {
      const updated = await emitWithAck<Room>('song-challenge:start', {
        roomCode: room.code,
        requesterId: identity.id,
      })
      set({ room: updated, error: null })
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
  submitSongPhrase: async (text) => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (!room || !identity) return null
    try {
      const result = await emitWithAck<{ room: Room; outcome: SongSubmitOutcome }>('song-challenge:submit', {
        roomCode: room.code,
        playerId: identity.id,
        text,
      })
      set({ room: result.room, error: null })
      return result.outcome
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return null
    }
  },
  chooseSong: async (songId) => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (!room || !identity) return
    try {
      const updated = await emitWithAck<Room>('song:choose', {
        roomCode: room.code,
        playerId: identity.id,
        songId,
      })
      set({ room: updated, error: null })
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
}))

let listenersBound = false

export function initRoomSync(): void {
  if (listenersBound) return
  listenersBound = true
  const applyRoom = (room: Room) => useRoomStore.getState().setRoom(room)
  socket.on('room:updated', applyRoom)
  socket.on('battle:started', applyRoom)
  socket.on('battle:finished', applyRoom)
  socket.on('chat:message', (message: ChatMessage) => useChatStore.getState().addMessage(message))
  socket.on('error:domain', (error: DomainErrorPayload) => useRoomStore.getState().setError(error.message))
  socket.io.on('reconnect', () => {
    const { room, joinRoom } = useRoomStore.getState()
    if (room) void joinRoom(room.code)
  })
}

export const useRoom = () => useRoomStore((state) => state.room)
export const useRoomError = () => useRoomStore((state) => state.error)
export const useRoomJoinError = () => useRoomStore((state) => state.joinError)

const selectPlayers = (state: RoomState): Player[] => state.room?.players ?? []
const selectDancers = (state: RoomState): Player[] => state.room?.dancers ?? []
const selectSpectators = (state: RoomState): Player[] => state.room?.spectators ?? []

export const usePlayers = () => useRoomStore(useShallow(selectPlayers))
export const useDancers = () => useRoomStore(useShallow(selectDancers))
export const useSpectators = () => useRoomStore(useShallow(selectSpectators))