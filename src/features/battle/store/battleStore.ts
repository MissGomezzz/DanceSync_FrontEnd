import { create } from 'zustand'
import type { BattleScore, BattleStatus } from '../../../shared/types'

interface BattleState {
  status: BattleStatus
  scores: BattleScore[]
  setStatus: (status: BattleStatus) => void
  updateScore: (playerId: string, points: number) => void
  reset: () => void
}

export const useBattleStore = create<BattleState>((set) => ({
  status: 'idle',
  scores: [],
  setStatus: (status) => set({ status }),
  updateScore: (playerId, points) =>
    set((state) => {
      const existing = state.scores.find((score) => score.playerId === playerId)
      if (!existing) {
        return { scores: [...state.scores, { playerId, points }] }
      }
      return {
        scores: state.scores.map((score) => (score.playerId === playerId ? { ...score, points } : score)),
      }
    }),
  reset: () => set({ status: 'idle', scores: [] }),
}))
