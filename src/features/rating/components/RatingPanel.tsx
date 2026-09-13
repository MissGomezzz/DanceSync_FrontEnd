import { useState } from 'react'
import { emitWithAck, SocketDomainError } from '../../../shared/lib/socket'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoom } from '../../rooms/store/roomStore'
import { RatingPanelView } from './RatingPanelView'

export const MAX_STARS = 5

export function RatingPanel() {
  const room = useRoom()
  const myId = useAuthStore((state) => state.identity?.id)
  const [error, setError] = useState<string | null>(null)
  const [pendingDancerId, setPendingDancerId] = useState<string | null>(null)

  if (!room || !room.battle || !room.dancers) return null

  const battle = room.battle
  const isSpectator = myId !== undefined && room.spectators.some((s) => s.id === myId)
  const myRatings = battle.ratings.filter((rating) => rating.raterId === myId)
  const scoreFor = (dancerId: string) => myRatings.find((rating) => rating.dancerId === dancerId)?.score ?? 0
  const isRated = (dancerId: string) => myRatings.some((rating) => rating.dancerId === dancerId)

  const handleRate = async (dancerId: string, score: number) => {
    if (!myId || pendingDancerId !== null || isRated(dancerId)) return
    setPendingDancerId(dancerId)
    try {
      // The battle finishes automatically on the server once every spectator
      // has rated both dancers; room updates arrive through room:updated.
      await emitWithAck<Room>('rating:submit', {
        roomCode: room.code,
        raterId: myId,
        dancerId,
        score,
      })
      setError(null)
    } catch (submitError) {
      if (submitError instanceof SocketDomainError && submitError.code === 'DUPLICATE_RATING') {
        setError('You already rated this dancer.')
      } else {
        setError(submitError instanceof Error ? submitError.message : 'Could not submit the rating')
      }
    } finally {
      setPendingDancerId(null)
    }
  }

  return (
    <RatingPanelView
      dancers={room.dancers}
      maxStars={MAX_STARS}
      canRate={isSpectator}
      scoreFor={scoreFor}
      isRated={isRated}
      pendingDancerId={pendingDancerId}
      error={error}
      onRate={(dancerId, score) => void handleRate(dancerId, score)}
    />
  )
}
