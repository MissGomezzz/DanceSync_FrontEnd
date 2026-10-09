import { create } from 'zustand'
import { httpClient } from '../../../shared/api/httpClient'
import { emitWithAck, socket, SocketDomainError } from '../../../shared/lib/socket'
import type { ChatMessage, DomainErrorPayload, MyVotePayload, Room, SongSubmitOutcome } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useVoteStore } from '../../voting/store/voteStore'
import { useWordRaceStore } from '../../wordRace/store/wordRaceStore'

export const MAX_PLAYERS = 7
export const MIN_PLAYERS_TO_START = 2

export const KICKED_NOTICE = 'The host removed you from the room.'

interface RoomState {
  room: Room | null
  error: string | null
  joinError: string | null
  /** Dismissible message for the home page (for example after being removed from a room). */
  notice: string | null
  /** Room the host removed this player from; the page showing it goes home and clears it. */
  kickedFrom: string | null
  setRoom: (room: Room | null) => void
  /**
   * Applies a room pushed by the server (broadcast or ack). Ignored unless it is
   * the room in the store or the one being joined: the socket may still be
   * subscribed to a room the player navigated away from.
   */
  receiveRoom: (room: Room) => void
  /** True when `code` is the current room or the one being joined. */
  isCurrentRoom: (code: string) => boolean
  setError: (error: string | null) => void
  dismissNotice: () => void
  /** Applies room:kicked: drops the room (if it is the current one) and leaves a notice for home. */
  receiveKick: (roomCode: string) => void
  /** Called once the page of the room the player was removed from has navigated away. */
  acknowledgeKick: () => void
  /** Drops the room and every room-scoped store (chat, word race, vote). */
  clear: () => void
  createRoom: (displayName: string) => Promise<Room | null>
  joinRoom: (roomCode: string) => Promise<Room | null>
  leaveRoom: () => Promise<void>
  selectRole: (role: 'dancer' | 'spectator') => Promise<void>
  /** Marks the player ready (true) or not ready (false) for every participant in the room. */
  setReady: (ready: boolean) => Promise<void>
  /** Host only: removes another player from the room. */
  kickPlayer: (playerId: string) => Promise<void>
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

/** Code of the room:join in flight, so its broadcasts are accepted before the ack. */
let pendingJoinCode: string | null = null

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  error: null,
  joinError: null,
  notice: null,
  kickedFrom: null,
  setRoom: (room) => set({ room }),
  receiveRoom: (room) => {
    if (!get().isCurrentRoom(room.code)) return
    // An error from the lobby (or the battle) is stale once the room changes phase.
    const phaseChanged = get().room?.status !== room.status
    set(phaseChanged ? { room, error: null } : { room })
  },
  isCurrentRoom: (code) => {
    const normalized = code.toUpperCase()
    return normalized === get().room?.code.toUpperCase() || normalized === pendingJoinCode
  },
  setError: (error) => set({ error }),
  dismissNotice: () => set({ notice: null }),
  receiveKick: (roomCode) => {
    if (!get().isCurrentRoom(roomCode)) return
    const code = roomCode.toUpperCase()
    if (pendingJoinCode === code) pendingJoinCode = null
    get().clear()
    set({ notice: KICKED_NOTICE, kickedFrom: code })
  },
  acknowledgeKick: () => set({ kickedFrom: null }),
  clear: () => {
    useChatStore.getState().clear()
    useWordRaceStore.getState().reset()
    useVoteStore.getState().reset()
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
    const previous = get().room
    if (previous && previous.code !== code) {
      // The player reached another room without "Leave room" (logo, Back, typed
      // URL): free the old seat first. Awaited because the server binds one room
      // per socket, and a late leave would unbind the new seat.
      get().clear()
      try {
        await emitWithAck<Room | null>('room:leave', { roomCode: previous.code, playerId: identity.id })
      } catch {
        // Best effort: the server also releases the seat once the room is gone.
      }
    } else if (!previous) {
      useChatStore.getState().clear()
    }
    pendingJoinCode = code
    // Joining a room makes an old "removed from the room" notice irrelevant.
    set({ joinError: null, notice: null, kickedFrom: null })
    try {
      const room = await emitWithAck<Room>('room:join', {
        roomCode: code,
        playerId: identity.id,
        displayName: identity.displayName,
      })
      set({ room, error: null, joinError: null })
      return room
    } catch (error) {
      // A failed rejoin (room closed while away) must not keep showing the stale room.
      const stale = get().room?.code === code
      set({ joinError: toErrorMessage(error), ...(stale ? { room: null } : {}) })
      return null
    } finally {
      if (pendingJoinCode === code) pendingJoinCode = null
    }
  },
  leaveRoom: async () => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    // Local state goes first: the caller navigates away right away and must not
    // wait for (or depend on) the server's answer.
    get().clear()
    if (room && identity) {
      try {
        await emitWithAck<Room | null>('room:leave', { roomCode: room.code, playerId: identity.id })
      } catch {
        // The room may already be gone or the server unreachable; leaving locally is enough.
      }
    }
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
      get().receiveRoom(updated)
      set({ error: null })
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
  setReady: async (ready) => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (!room || !identity) return
    try {
      const updated = await emitWithAck<Room>('player:ready', {
        roomCode: room.code,
        playerId: identity.id,
        ready,
      })
      get().receiveRoom(updated)
      set({ error: null })
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
  kickPlayer: async (playerId) => {
    const { room } = get()
    const identity = useAuthStore.getState().identity
    if (!room || !identity) return
    try {
      const updated = await emitWithAck<Room>('player:kick', {
        roomCode: room.code,
        requesterId: identity.id,
        playerId,
      })
      get().receiveRoom(updated)
      set({ error: null })
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
      get().receiveRoom(updated)
      set({ error: null })
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
      get().receiveRoom(updated)
      set({ error: null })
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
      get().receiveRoom(result.room)
      set({ error: null })
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
      get().receiveRoom(updated)
      set({ error: null })
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
}))

let listenersBound = false

export function initRoomSync(): void {
  if (listenersBound) return
  listenersBound = true
  const applyRoom = (room: Room) => useRoomStore.getState().receiveRoom(room)
  socket.on('room:updated', applyRoom)
  socket.on('battle:started', applyRoom)
  socket.on('battle:finished', applyRoom)
  socket.on('chat:message', (message: ChatMessage) => {
    if (useRoomStore.getState().isCurrentRoom(message.roomCode)) useChatStore.getState().addMessage(message)
  })
  // Only the voter receives their own vote (on their private channel), after each change and on rejoin.
  socket.on('vote:mine', (payload: MyVotePayload) => {
    if (useRoomStore.getState().isCurrentRoom(payload.roomCode)) useVoteStore.getState().receiveMine(payload)
  })
  socket.on('room:kicked', (payload: { roomCode: string }) => useRoomStore.getState().receiveKick(payload.roomCode))
  socket.on('error:domain', (error: DomainErrorPayload) => useRoomStore.getState().setError(error.message))
  socket.io.on('reconnect', () => {
    const { room, joinRoom } = useRoomStore.getState()
    if (room) void joinRoom(room.code)
  })
}

export const useRoom = () => useRoomStore((state) => state.room)
export const useRoomError = () => useRoomStore((state) => state.error)
export const useRoomJoinError = () => useRoomStore((state) => state.joinError)
export const useRoomNotice = () => useRoomStore((state) => state.notice)
export const useKickedFrom = () => useRoomStore((state) => state.kickedFrom)
