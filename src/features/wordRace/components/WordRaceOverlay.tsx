import { useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { useRoundCountdown } from '../hooks/useRoundCountdown'
import {
  useActiveWordRound,
  useWordRaceAttempt,
  useWordRaceResult,
  useWordRaceStore,
  type ActiveWordRound,
} from '../store/wordRaceStore'
import type { WordRaceBanner } from '../types'
import { WordRaceOverlayView } from './WordRaceOverlayView'

/**
 * Mid-battle word race shown over the dance stage. Events are fed into the store
 * by useWordRaceSync (mounted by the battle stage); this container only reads it.
 */
export function WordRaceOverlay() {
  const round = useActiveWordRound()
  const result = useWordRaceResult()
  if (!round && !result) return null
  // Keyed by round so the typed text resets and the input regains focus every round.
  return <WordRaceOverlayContent key={round?.roundId ?? 'result'} round={round} result={result} />
}

interface WordRaceOverlayContentProps {
  round: ActiveWordRound | null
  result: WordRaceBanner | null
}

function WordRaceOverlayContent({ round, result }: WordRaceOverlayContentProps) {
  const myId = useAuthStore((state) => state.identity?.id ?? null)
  const isDancer = useRoomStore(
    (state) => myId !== null && (state.room?.battle?.dancerIds.includes(myId) ?? false),
  )
  const { submitting, lastAttempt } = useWordRaceAttempt()
  const submitWord = useWordRaceStore((state) => state.submitWord)
  const clearAttempt = useWordRaceStore((state) => state.clearAttempt)
  const remainingMs = useRoundCountdown(round?.deadline ?? null)
  const [typed, setTyped] = useState('')

  const handleTypedChange = (value: string) => {
    setTyped(value)
    if (lastAttempt) clearAttempt()
  }

  const handleSubmit = () => {
    if (myId) void submitWord(typed, myId)
  }

  return (
    <WordRaceOverlayView
      round={
        round && {
          word: round.word,
          roundNumber: round.roundNumber,
          totalRounds: round.totalRounds,
          remainingMs,
          totalMs: round.totalMs,
        }
      }
      result={result}
      isDancer={isDancer}
      typed={typed}
      submitting={submitting}
      notice={lastAttempt === 'incorrect' ? 'Not quite, try again' : null}
      onTypedChange={handleTypedChange}
      onSubmit={handleSubmit}
    />
  )
}
