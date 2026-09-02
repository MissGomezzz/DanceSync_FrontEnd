import { create } from 'zustand'
import type { Rating } from '../../../shared/types'

export const MIN_STARS = 1
export const MAX_STARS = 5

interface RatingState {
  ratings: Rating[]
  submitted: boolean
  rate: (rating: Rating) => void
  submit: () => void
  reset: () => void
}

export const useRatingStore = create<RatingState>((set) => ({
  ratings: [],
  submitted: false,
  rate: (rating) =>
    set((state) => ({
      ratings: [
        ...state.ratings.filter((r) => !(r.raterId === rating.raterId && r.dancerId === rating.dancerId)),
        rating,
      ],
    })),
  submit: () => set({ submitted: true }),
  reset: () => set({ ratings: [], submitted: false }),
}))
