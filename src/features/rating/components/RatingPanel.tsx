import { useAuthStore } from '../../auth/store/authStore'
import { selectDancers, useRoomStore } from '../../rooms/store/roomStore'
import { MAX_STARS, useRatingStore } from '../store/ratingStore'
import { RatingPanelView } from './RatingPanelView'

export function RatingPanel() {
  const dancers = useRoomStore(selectDancers)
  const user = useAuthStore((state) => state.user)
  const ratings = useRatingStore((state) => state.ratings)
  const submitted = useRatingStore((state) => state.submitted)
  const rate = useRatingStore((state) => state.rate)
  const submit = useRatingStore((state) => state.submit)

  const raterId = user?.id ?? 'anonymous'

  const starsFor = (dancerId: string) =>
    ratings.find((rating) => rating.raterId === raterId && rating.dancerId === dancerId)?.stars ?? 0

  const handleRate = (dancerId: string, stars: number) => {
    rate({ raterId, dancerId, stars })
  }

  const handleSubmit = () => {
    // Ratings will be sent to the rating service once it is available.
    submit()
  }

  return (
    <RatingPanelView
      dancers={dancers}
      maxStars={MAX_STARS}
      starsFor={starsFor}
      submitted={submitted}
      onRate={handleRate}
      onSubmit={handleSubmit}
    />
  )
}
