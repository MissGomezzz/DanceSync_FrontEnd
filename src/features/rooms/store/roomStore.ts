import { create } from 'zustand'
import type { Player } from '../../../shared/types'

export const MAX_PLAYERS = 8
export const MAX_DANCERS = 2

interface RoomState {
  roomId: string | null
  players: Player[]
  setRoom: (roomId: string, players?: Player[]) => void
  addPlayer: (player: Player) => boolean
  removePlayer: (playerId: string) => void
  leaveRoom: () => void
}

export const useRoomStore = create<RoomState>((set, get) => ({
  roomId: null,
  players: [],
  setRoom: (roomId, players = []) => set({ roomId, players }),
  addPlayer: (player) => {
    const { players } = get()
    if (players.length >= MAX_PLAYERS || players.some((p) => p.id === player.id)) {
      return false
    }
    set({ players: [...players, player] })
    return true
  },
  removePlayer: (playerId) => set((state) => ({ players: state.players.filter((p) => p.id !== playerId) })),
  leaveRoom: () => set({ roomId: null, players: [] }),
}))

/** Selectors derived from the players list. */
export const selectDancers = (state: RoomState) => state.players.filter((p) => p.role === 'dancer').slice(0, MAX_DANCERS)
export const selectSpectators = (state: RoomState) => state.players.filter((p) => p.role === 'spectator')
