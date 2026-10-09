import { useState } from 'react'
import { useCountdown, useServerDeadline } from '../../../shared/hooks/useCountdown'
import { emitWithAck, SocketDomainError } from '../../../shared/lib/socket'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoom } from '../../rooms/store/roomStore'
import { RatingPanelView } from './RatingPanelView'

export const MAX_STARS = 5

const ratingErrorMessages: Record<string, string> = {
  DUPLICATE_RATING: 'You already rated this dancer.',
  BATTLE_NOT_STARTED: 'The battle has not started yet. You can rate once the music begins.',
}

const seconds = (ms: number) => Math.ceil(ms / 1000)

export function RatingPanel() {
  const room = useRoom()
  const myId = useAuthStore((state) => state.identity?.id)
  const [error, setError] = useState<string | null>(null)
  const [pendingDancerId, setPendingDancerId] = useState<string | null>(null)

  const battle = room?.battle ?? null
  // Both deadlines are server-relative and re-anchored on every room payload.
  const startsInMs = battle?.startsInMs
  const startDeadline = useServerDeadline(typeof startsInMs === 'number' && startsInMs > 0 ? startsInMs : null, battle)
  const startsIn = useCountdown(startDeadline)
  const endDeadline = useServerDeadline(battle?.endsInMs ?? null, battle)
  const closesIn = useCountdown(endDeadline)

  if (!room || !battle || !room.dancers) return null

  const notStarted = startDeadline !== null && startsIn > 0
  const closed = !notStarted && endDeadline !== null && closesIn === 0
  const timing = notStarted
    ? `The battle starts in ${seconds(startsIn)}s`
    : closed
      ? 'Ratings are closed.'
      : endDeadline !== null
        ? `Ratings close in ${seconds(closesIn)}s`
        : null

  const isSpectator = myId !== undefined && room.spectators.some((s) => s.id === myId)
  const myRatings = battle.ratings.filter((rating) => rating.raterId === myId)
  const scoreFor = (dancerId: string) => myRatings.find((rating) => rating.dancerId === dancerId)?.score ?? 0
  const isRated = (dancerId: string) => myRatings.some((rating) => rating.dancerId === dancerId)

  const handleRate = async (dancerId: string, score: number) => {
    if (!myId || notStarted || closed || pendingDancerId !== null || isRated(dancerId)) return
    setPendingDancerId(dancerId)
    try {
      // The battle finishes automatically on the server once every spectator
      // has rated every dancer; room updates arrive through room:updated.
      await emitWithAck<Room>('rating:submit', {
        roomCode: room.code,
        raterId: myId,
        dancerId,
        score,
      })
      setError(null)
    } catch (submitError) {
      const known = submitError instanceof SocketDomainError ? ratingErrorMessages[submitError.code] : undefined
      setError(known ?? (submitError instanceof Error ? submitError.message : 'Could not submit the rating'))
    } finally {
      setPendingDancerId(null)
    }
  }

  return (
    <RatingPanelView
      dancers={room.dancers}
      maxStars={MAX_STARS}
      canRate={isSpectator}
      locked={notStarted || closed}
      timing={timing}
      scoreFor={scoreFor}
      isRated={isRated}
      pendingDancerId={pendingDancerId}
      error={error}
      onRate={(dancerId, score) => void handleRate(dancerId, score)}
    />
  )
}
